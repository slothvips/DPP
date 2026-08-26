import { z } from 'zod/v4';
import { PageAgentCore, tool } from '@page-agent/core';
import type { AgentConfig, ToolContext } from '@page-agent/core';
import type { PageController } from '@page-agent/page-controller';
import { RemotePageController } from './remotePageController';
import { TabsController } from './tabsController';

export interface MultiPageAgentConfig extends AgentConfig {
  initialTabId: number;
  onRequestUser?: (reason: string) => Promise<void>;
}

export class MultiPageAgent extends PageAgentCore {
  constructor(config: MultiPageAgentConfig) {
    const tabs = new TabsController(config.initialTabId);
    const controller = new RemotePageController(tabs);
    super({
      ...config,
      experimentalScriptExecutionTool: false,
      pageController: controller as unknown as PageController,
      customTools: {
        ...config.customTools,
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
  }
}
