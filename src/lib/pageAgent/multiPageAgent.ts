import { z } from 'zod/v4';
import { PageAgentCore, tool } from '@page-agent/core';
import type { AgentConfig, ToolContext } from '@page-agent/core';
import type { PageController } from '@page-agent/page-controller';
import { RemotePageController } from './remotePageController';
import { TabsController } from './tabsController';

interface MultiPageAgentConfig extends AgentConfig {
  initialTabId: number;
  groupName?: string;
}

const MULTI_PAGE_INSTRUCTIONS = `你正在浏览器中执行网页任务。
- 浏览器状态顶部会列出本次任务跟踪的标签页及 ID。
- 页面操作始终作用于标记为“当前页面”的标签页。
- 需要访问新地址时使用 open_new_tab；需要回到已有页面时使用 switch_to_tab。
- 动作必须使用完整工具名；URL 必须作为 open_new_tab 的 url 参数，不能把 url 当作动作名。
- 点击后若网页打开了新标签页，下一步先检查任务标签页列表，再决定是否切换。
- 只可切换或关闭本次任务跟踪的标签页，且不可关闭起始标签页。`;

export class MultiPageAgent extends PageAgentCore {
  constructor(config: MultiPageAgentConfig) {
    const tabsController = new TabsController(config.initialTabId);
    const remoteController = new RemotePageController(tabsController);
    const existingInstructions = config.instructions?.system;

    super({
      ...config,
      experimentalScriptExecutionTool: false,
      pageController: remoteController as unknown as PageController,
      instructions: {
        ...config.instructions,
        system: existingInstructions
          ? `${existingInstructions}\n\n${MULTI_PAGE_INSTRUCTIONS}`
          : MULTI_PAGE_INSTRUCTIONS,
      },
      customTools: {
        ...config.customTools,
        open_new_tab: tool({
          description: '打开一个新浏览器标签页，并将其设为后续页面操作的当前标签页。',
          inputSchema: z.object({ url: z.string().url() }),
          execute: async (_input: { url: string }, _context: ToolContext) =>
            tabsController.openNewTab(_input.url),
        }),
        url: tool({
          description: '兼容 URL 简写：打开一个新浏览器标签页，并切换后续页面操作目标。',
          inputSchema: z.url(),
          execute: async (_url: string, _context: ToolContext) => tabsController.openNewTab(_url),
        }),
        switch_to_tab: tool({
          description: '按标签页 ID 切换后续页面操作的目标。ID 必须来自浏览器状态。',
          inputSchema: z.object({ tab_id: z.number().int() }),
          execute: async (_input: { tab_id: number }) => tabsController.switchToTab(_input.tab_id),
        }),
        tab_id: tool({
          description: '兼容标签页 ID 简写：切换后续页面操作的目标标签页。',
          inputSchema: z.union([z.number().int(), z.object({ tab_id: z.number().int() })]),
          execute: async (_input: number | { tab_id: number }) =>
            tabsController.switchToTab(typeof _input === 'number' ? _input : _input.tab_id),
        }),
        close_tab: tool({
          description: '关闭本次任务打开或跟踪的标签页。不能关闭初始标签页。',
          inputSchema: z.object({ tab_id: z.number().int() }),
          execute: async (_input: { tab_id: number }) => tabsController.closeTab(_input.tab_id),
        }),
      },
      onBeforeTask: async (agent) => {
        await tabsController.init(agent.task, config.groupName);
        await config.onBeforeTask?.(agent);
      },
      onBeforeStep: async (agent, stepCount) => {
        await tabsController.syncTabs();
        if (tabsController.currentTabId !== null) {
          await tabsController.waitUntilTabLoaded(tabsController.currentTabId);
        }
        await config.onBeforeStep?.(agent, stepCount);
      },
      onDispose: (agent, reason) => {
        tabsController.dispose();
        config.onDispose?.(agent, reason);
      },
    });
  }
}
