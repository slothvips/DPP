// PageAgent AI tool - Execute natural language tasks on the user-selected page
import { browser } from 'wxt/browser';
import { PAGE_AGENT_TASK_GROUP_STORAGE_KEY } from '@/lib/pageAgent/multiPageTypes';
import type { PageAgentTaskSummary } from '@/lib/pageAgent/multiPageTypes';
import { isInjectable } from '@/lib/pageAgent/utils';
import { logger } from '@/utils/logger';
import { createToolParameter, toolRegistry } from '../tools';
import type { ToolHandler } from '../tools';

let activeTaskId: string | null = null;

/**
 * Execute a natural language task on the user-selected page using PageAgent
 */
async function pageagent_execute_task(args: { task: string; group_name?: string }): Promise<{
  success: boolean;
  message: string;
}> {
  logger.info('[PageAgent Tool] 开始执行任务:', args.task);

  // 获取已选择的标签页 ID，null 表示使用当前活动标签页
  // session storage 中没有该 key 或值为 null 时，从当前活动标签页开始
  let tabId: number | null = null;
  try {
    const result = await browser.storage.session.get('__pageAgentTabId');
    logger.info('[PageAgent Tool] session storage result:', JSON.stringify(result));
    const storedValue = result.__pageAgentTabId;
    // 只有当值是数字时才使用固定起始标签页，否则从当前活动标签页开始
    tabId = typeof storedValue === 'number' ? storedValue : null;
    logger.info('[PageAgent Tool] tabId from storage:', tabId);
  } catch (error) {
    logger.error('[PageAgent Tool] 读取 session storage 失败:', error);
  }

  try {
    tabId = await resolveStartTabId(tabId);
    if (tabId === null) return { success: false, message: '无法获取当前活动标签页' };

    await ensurePageAgentHost();
    const taskId = crypto.randomUUID();
    activeTaskId = taskId;
    const startResponse = (await browser.runtime.sendMessage({
      type: 'PAGE_AGENT_TASK_START',
      taskId,
      task: args.task,
      groupName: args.group_name,
      initialTabId: tabId,
    })) as { success?: boolean; error?: string };
    if (!startResponse?.success)
      return { success: false, message: startResponse?.error || '任务启动失败' };
    const status = await waitForPageAgentTask(taskId);
    logger.info('[PageAgent Tool] 多页面任务完成:', status.status);
    return {
      success: status.status === 'completed' && status.result?.success === true,
      message: status.result?.data || status.error || '任务未完成',
    };
  } catch (error) {
    logger.error('[PageAgent Tool] 执行出错:', error);

    // 提供更友好的错误消息
    let errorMessage = '执行失败';
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        errorMessage = '多页面任务执行超时或被取消，请缩小任务范围后重试';
      } else if (error.message.includes('Extension context invalidated')) {
        errorMessage = '扩展上下文已失效，请重新加载扩展';
      } else if (error.message.includes('No receiving end')) {
        errorMessage = '消息传递失败，请重新加载扩展';
      } else {
        errorMessage = error.message;
      }
    }

    return {
      success: false,
      message: errorMessage,
    };
  } finally {
    activeTaskId = null;
  }
}

async function resolveStartTabId(storedTabId: number | null): Promise<number | null> {
  if (storedTabId !== null) {
    try {
      const storedTab = await browser.tabs.get(storedTabId);
      if (storedTab.url && isInjectable(storedTab.url)) return storedTabId;
    } catch (error) {
      logger.warn('[PageAgent Tool] 已选择的起始标签页不可用，将回退到当前标签页:', error);
    }
    await browser.storage.session.remove('__pageAgentTabId');
  }

  const activeTabs = await browser.tabs.query({ active: true, lastFocusedWindow: true });
  const activeTab = activeTabs.find(
    (tab) => tab.id !== undefined && tab.url && isInjectable(tab.url)
  );
  if (activeTab?.id !== undefined) return activeTab.id;

  const fallbackTabs = await browser.tabs.query({ active: true });
  const fallbackActiveTab = fallbackTabs.find(
    (tab) => tab.id !== undefined && tab.url && isInjectable(tab.url)
  );
  if (fallbackActiveTab?.id !== undefined) return fallbackActiveTab.id;

  const allTabs = await browser.tabs.query({});
  return (
    allTabs.find((tab) => tab.id !== undefined && tab.url && isInjectable(tab.url))?.id ?? null
  );
}

async function waitForPageAgentTask(taskId: string): Promise<PageAgentTaskSummary> {
  return new Promise<PageAgentTaskSummary>((resolve, reject) => {
    let settled = false;
    const timeoutId = setTimeout(
      () => {
        if (settled) return;
        settled = true;
        browser.runtime.onMessage.removeListener(listener);
        void browser.runtime
          .sendMessage({ type: 'PAGE_AGENT_TASK_STOP', taskId })
          .catch(() => undefined);
        reject(new Error('网页任务执行超时，已请求停止任务'));
      },
      5 * 60 * 1000
    );

    const finish = (summary: PageAgentTaskSummary) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      browser.runtime.onMessage.removeListener(listener);
      resolve(summary);
    };

    const listener = (message: unknown): false | undefined => {
      if (!isTaskEventFor(message, taskId)) return;
      const summary = message.event;
      if (isTerminalTaskStatus(summary.status)) finish(summary as PageAgentTaskSummary);
      return false;
    };

    browser.runtime.onMessage.addListener(listener);
    void browser.runtime
      .sendMessage({ type: 'PAGE_AGENT_TASK_SUBSCRIBE', taskId })
      .then((response: unknown) => {
        if (!isTaskSummary(response, taskId)) return;
        if (isTerminalTaskStatus(response.status)) finish(response);
      })
      .catch((error: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        browser.runtime.onMessage.removeListener(listener);
        reject(error);
      });
  });
}

function isTaskEventFor(
  message: unknown,
  taskId: string
): message is {
  type: 'PAGE_AGENT_TASK_EVENT';
  taskId: string;
  event: Partial<PageAgentTaskSummary>;
} {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === 'PAGE_AGENT_TASK_EVENT' &&
    'taskId' in message &&
    message.taskId === taskId &&
    'event' in message &&
    typeof message.event === 'object' &&
    message.event !== null
  );
}

function isTaskSummary(message: unknown, taskId: string): message is PageAgentTaskSummary {
  return (
    typeof message === 'object' &&
    message !== null &&
    'taskId' in message &&
    message.taskId === taskId &&
    'status' in message &&
    typeof message.status === 'string'
  );
}

function isTerminalTaskStatus(status: unknown): boolean {
  return status === 'completed' || status === 'failed' || status === 'stopped';
}

export function stopActivePageAgentTask(): void {
  if (!activeTaskId) return;
  const taskId = activeTaskId;
  void browser.runtime
    .sendMessage({ type: 'PAGE_AGENT_TASK_STOP', taskId })
    .catch((error: unknown) => logger.warn('[PageAgent Tool] 停止任务失败:', error));
}

export async function resetPageAgentTaskGroup(): Promise<void> {
  await browser.storage.session.remove(PAGE_AGENT_TASK_GROUP_STORAGE_KEY);
}

async function ensurePageAgentHost(): Promise<void> {
  const hostUrl = browser.runtime.getURL('/pageAgentHost.html');
  const hosts = await browser.tabs.query({ url: hostUrl });
  if (hosts.length === 0) {
    await browser.storage.session.set({ __dpp_page_agent_host_ready: false });
    await browser.tabs.create({ url: hostUrl, active: false, pinned: true });
  }
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const ready = await browser.storage.session.get('__dpp_page_agent_host_ready');
    if (ready.__dpp_page_agent_host_ready === true) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('PageAgent Host 未准备就绪');
}

/**
 * Register PageAgent tool
 */
export function registerPageAgentTools(): void {
  toolRegistry.register({
    name: 'pageagent_execute_task',
    description:
      '使用 PageAgent 在一个或多个浏览器标签页中执行自然语言任务。支持点击、填写、读取、打开新标签页、切换标签页和关闭任务标签页。请用中文描述完整且明确的网页任务，并填写与任务相关的 group_name。',
    parameters: createToolParameter(
      {
        task: {
          type: 'string',
          description:
            '用中文描述要执行的网页任务，可包含跨页面目标。例如："在当前页面找到项目文档链接，在新标签页打开并提取安装命令，然后回到原页面"。',
        },
        group_name: {
          type: 'string',
          description:
            '为本次任务生成一个简短、明确、与任务目标相关的分组名称，建议 2-8 个中文词，不要包含 DPP 前缀。',
        },
      },
      ['task']
    ),
    handler: pageagent_execute_task as ToolHandler,
    requiresConfirmation: true,
  });
}
