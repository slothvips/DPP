import { z } from 'zod/v4';
import { PageAgentCore, tool } from '@page-agent/core';
import type { AgentConfig, ToolContext } from '@page-agent/core';
import type { PageController } from '@page-agent/page-controller';
import { RemotePageController } from './remotePageController';
import { TabsController } from './tabsController';
import { createTestStepDoneTool } from './testStepDoneTool';
import type { PageAgentTestStepResult } from './testStepDoneTool';

export interface MultiPageAgentConfig extends AgentConfig {
  initialTabId: number;
  resultMode?: 'test-step';
  onRequestUser?: (reason: string) => Promise<void>;
}

export class MultiPageAgent extends PageAgentCore {
  private readonly readCapturedTestStepResult: () => PageAgentTestStepResult | undefined;

  constructor(config: MultiPageAgentConfig) {
    let capturedTestStepResult: PageAgentTestStepResult | undefined;
    const tabs = new TabsController(config.initialTabId);
    const controller = new RemotePageController(tabs, async (reason) => {
      if (!config.onRequestUser) throw new Error('当前任务不支持用户接管');
      await config.onRequestUser(reason);
    });
    const testStepInstructions =
      config.resultMode === 'test-step'
        ? '当前是测试步骤模式。完成当前步骤后必须调用 done({ status, actualResult, detail }) 结束任务；不要用普通文字结束。status 只能是 passed、failed 或 blocked，actualResult 必须是基于页面事实的非空文本，detail 可选。只报告当前步骤，不执行后续步骤；断言不符或证据不足时使用 failed，只有前置条件、权限或业务状态确实阻止继续时使用 blocked，不得猜测为 passed。'
        : undefined;
    super({
      ...config,
      experimentalScriptExecutionTool: false,
      pageController: controller as unknown as PageController,
      instructions: {
        ...config.instructions,
        ...(testStepInstructions
          ? {
              system: [config.instructions?.system, testStepInstructions]
                .filter(Boolean)
                .join('\n'),
            }
          : {}),
      },
      customTools: {
        ...config.customTools,
        ...(config.resultMode === 'test-step'
          ? {
              done: createTestStepDoneTool((result) => {
                capturedTestStepResult = result;
              }),
            }
          : {}),
        open_new_tab: tool({
          description: '打开一个新浏览器标签页，并切换到该页面。',
          inputSchema: z.object({
            url: z.url().refine((value) => /^https?:\/\//.test(value), '仅支持 HTTP(S) 网页'),
          }),
          execute: async (input: { url: string }, _context: ToolContext) =>
            tabs.openNewTab(input.url),
        }),
        switch_to_tab: tool({
          description: '切换到本次任务跟踪的标签页。',
          inputSchema: z.object({ tab_id: z.number().int() }),
          execute: async (input: { tab_id: number }) => tabs.switchToTab(input.tab_id),
        }),
        close_tab: tool({
          description: '关闭本次任务打开的标签页。不能关闭起始标签页。',
          inputSchema: z.object({ tab_id: z.number().int() }),
          execute: async (input: { tab_id: number }) => tabs.closeTab(input.tab_id),
        }),
        browser_request_user: tool({
          description:
            '仅当页面确实要求用户完成登录、验证码、二次验证或权限审批，且 Agent 无法自动继续时暂停任务。不得用于普通提交、发送、确认操作，也不得因不确定而请求接管。',
          inputSchema: z.object({ reason: z.string().min(1) }),
          execute: async (input: { reason: string }) => {
            if (!config.onRequestUser) throw new Error('当前任务不支持用户接管');
            await config.onRequestUser(input.reason);
            return '用户已完成接管操作，继续执行任务';
          },
        }),
      },
      onBeforeTask: async (agent) => {
        await tabs.init(agent.task);
        await config.onBeforeTask?.(agent);
      },
      onBeforeStep: async (agent, step) => {
        await tabs.syncTabs();
        if (tabs.currentTabId !== null) await tabs.waitUntilTabLoaded(tabs.currentTabId);
        await config.onBeforeStep?.(agent, step);
      },
      onDispose: (agent, reason) => {
        tabs.dispose();
        config.onDispose?.(agent, reason);
      },
    });
    this.readCapturedTestStepResult = () => capturedTestStepResult;
  }

  get testStepResult(): PageAgentTestStepResult | undefined {
    return this.readCapturedTestStepResult();
  }
}
