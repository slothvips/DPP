import { browser } from 'wxt/browser';
import { createToolParameter, toolRegistry } from '@/lib/ai/tools';
import type { ToolHandler } from '@/lib/ai/tools';
import type { BrowserTaskStopSource, BrowserTaskSummary } from '@/lib/browserTask/types';
import {
  deleteBrowserTaskRecord,
  getBrowserTaskRecord,
  reserveBrowserTask,
} from '@/lib/db/browserTasks';

const MAX_TASK_RESULT_LENGTH = 2000;
const taskIdsBySession = new Map<string, Set<string>>();

export async function delegateBrowserAgent(args: {
  task: string;
  tab_id?: number;
  initial_url?: string;
  open_new_tab?: boolean;
  resource_keys?: string[];
  test_target_id?: string;
  session_id?: string;
  tool_call_id?: string;
  onUpdate?: (event: Partial<BrowserTaskSummary>) => void;
}): Promise<{ success: boolean; message: string }> {
  const idempotencyKey =
    args.session_id && args.tool_call_id ? `${args.session_id}:${args.tool_call_id}` : undefined;
  const taskId = crypto.randomUUID();
  let reservationCreated = false;
  if (idempotencyKey) {
    const reservation = await reserveBrowserTask({
      taskId,
      idempotencyKey,
      sessionId: args.session_id,
      toolCallId: args.tool_call_id,
      task: args.task,
    });
    reservationCreated = reservation.created;
    if (!reservation.created) {
      const existing = reservation.record;
      if (isTerminal(existing.summary.status)) {
        return {
          success: existing.summary.status === 'completed',
          message: (existing.summary.result || existing.summary.error || '任务未完成').slice(
            0,
            MAX_TASK_RESULT_LENGTH
          ),
        };
      }
      return waitForTask(existing.taskId, args.onUpdate, undefined).then((summary) => ({
        success: summary.status === 'completed',
        message: (summary.result || summary.error || '任务未完成').slice(0, MAX_TASK_RESULT_LENGTH),
      }));
    }
  }
  const target = await getTargetTab(args.tab_id, args.initial_url, args.open_new_tab);
  if (!target) {
    if (reservationCreated) await deleteBrowserTaskRecord(taskId);
    return { success: false, message: '当前活动页面无法运行网页助手' };
  }
  const sessionKey = args.session_id || '';
  const taskIds = taskIdsBySession.get(sessionKey) || new Set<string>();
  taskIds.add(taskId);
  taskIdsBySession.set(sessionKey, taskIds);

  try {
    const summary = await waitForTask(
      taskId,
      args.onUpdate,
      () =>
        browser.runtime.sendMessage({
          type: 'BROWSER_TASK_START',
          taskId,
          task: args.task,
          sessionId: args.session_id,
          toolCallId: args.tool_call_id,
          initialTabId: target.tabId,
          resourceKeys: normalizeResourceKeys(
            args.resource_keys,
            args.initial_url,
            args.test_target_id
          ),
        }) as Promise<{ success?: boolean; error?: string }>
    );
    return {
      success: summary.status === 'completed',
      message: (summary.result || summary.error || '任务未完成').slice(0, MAX_TASK_RESULT_LENGTH),
    };
  } catch (error) {
    if (reservationCreated) await deleteBrowserTaskRecord(taskId);
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
    };
  } finally {
    taskIds.delete(taskId);
    if (taskIds.size === 0) taskIdsBySession.delete(sessionKey);
  }
}

export async function stopActiveBrowserTask(
  sessionId?: string,
  source: BrowserTaskStopSource = 'browser'
): Promise<void> {
  const taskIds = [...(taskIdsBySession.get(sessionId || '') || [])];
  await Promise.all(
    taskIds.map((taskId) =>
      browser.runtime.sendMessage({ type: 'BROWSER_TASK_STOP', taskId, source, sessionId })
    )
  );
}

export async function listBrowserTabs(): Promise<{ tabId: number; title: string; url: string }[]> {
  const tabs = await browser.tabs.query({});
  return tabs.flatMap((tab) => {
    if (typeof tab.id !== 'number' || !isInjectableUrl(tab.url)) return [];
    return [{ tabId: tab.id, title: tab.title || '', url: tab.url }];
  });
}

export function registerBrowserTaskTools(): void {
  toolRegistry.register({
    name: 'delegate_browser_agent',
    description:
      '接受 D 仔委派的网页任务，独立执行并在完成后向 D 仔汇报结果。只能处理当前任务，不得扩展目标。可通过 tab_id 指定目标标签页。',
    parameters: createToolParameter(
      {
        task: {
          type: 'string',
          description: '交给浏览器子 Agent 的网页任务目标和完成标准',
        },
        tab_id: {
          type: 'integer',
          description: '目标标签页 ID；不填写时使用当前活动标签页',
        },
        initial_url: {
          type: 'string',
          description: '没有可用 HTTP(S) 活动页时创建的初始目标 URL',
        },
        open_new_tab: {
          type: 'boolean',
          description: '需要为目标 URL 创建独立任务标签页时设为 true；必须同时提供 initial_url',
        },
        test_target_id: {
          type: 'string',
          description: '测试用例步骤所属的目标网页 ID；执行测试用例步骤时必须提供',
        },
        resource_keys: {
          type: 'array',
          description: '可选共享资源锁，例如 account:foo、order:123；共享资源的任务会串行',
          items: { type: 'string', description: '资源键' },
        },
      },
      ['task']
    ),
    handler: delegateBrowserAgent as ToolHandler,
    requiresConfirmation: true,
  });
  toolRegistry.register({
    name: 'list_browser_tabs',
    description: '列出当前可操作的 HTTP(S) 标签页，供选择网页任务目标。',
    parameters: createToolParameter({}),
    handler: listBrowserTabs as ToolHandler,
  });
}

async function getTargetTab(
  tabId?: number,
  initialUrl?: string,
  openNewTab = false
): Promise<{ tabId: number; created: boolean } | null> {
  if (openNewTab) {
    if (!initialUrl || !isInjectableUrl(initialUrl)) return null;
    try {
      const created = await browser.tabs.create({ url: initialUrl, active: false });
      return typeof created.id === 'number' ? { tabId: created.id, created: true } : null;
    } catch {
      return null;
    }
  }

  try {
    const tab =
      tabId === undefined
        ? (await browser.tabs.query({ active: true, currentWindow: true }))[0]
        : await browser.tabs.get(tabId);
    if (typeof tab?.id === 'number' && isInjectableUrl(tab.url)) {
      return { tabId: tab.id, created: false };
    }
    if (!initialUrl || !isInjectableUrl(initialUrl)) return null;
    const created = await browser.tabs.create({ url: initialUrl, active: true });
    return typeof created.id === 'number' ? { tabId: created.id, created: true } : null;
  } catch {
    if (!initialUrl || !isInjectableUrl(initialUrl)) return null;
    try {
      const created = await browser.tabs.create({ url: initialUrl, active: true });
      return typeof created.id === 'number' ? { tabId: created.id, created: true } : null;
    } catch {
      return null;
    }
  }
}

function isInjectableUrl(url: string | undefined): url is string {
  return url?.startsWith('http://') === true || url?.startsWith('https://') === true;
}

function normalizeResourceKeys(
  value: unknown,
  initialUrl?: string,
  testTargetId?: string
): string[] | undefined {
  const keys = (Array.isArray(value) ? value : [])
    .filter((key): key is string => typeof key === 'string')
    .map((key) => key.trim().slice(0, 120))
    .filter(Boolean)
    .slice(0, 10);
  const origin = initialUrl ? getUrlOrigin(initialUrl) : undefined;
  if (origin) keys.push(`browser-origin:${origin}`);
  if (testTargetId?.trim()) keys.push(`test-target:${testTargetId.trim().slice(0, 120)}`);
  return keys.length > 0 ? [...new Set(keys)] : undefined;
}

function getUrlOrigin(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin : undefined;
  } catch {
    return undefined;
  }
}

async function waitForTask(
  taskId: string,
  onUpdate: ((event: Partial<BrowserTaskSummary>) => void) | undefined,
  start?: () => Promise<{ success?: boolean; error?: string }>
): Promise<BrowserTaskSummary> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const poll = setInterval(() => {
      void getBrowserTaskRecord(taskId)
        .then((record) => {
          if (!record) return;
          onUpdate?.(record.summary);
          if (isTerminal(record.summary.status)) finish(record.summary);
        })
        .catch(() => undefined);
    }, 2000);
    const timeout = setTimeout(
      () => {
        void browser.runtime.sendMessage({ type: 'BROWSER_TASK_STOP', taskId });
        finishError(new Error('网页任务执行超时'));
      },
      60 * 60 * 1000
    );
    const finish = (summary: BrowserTaskSummary) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      clearInterval(poll);
      browser.runtime.onMessage.removeListener(listener);
      resolve(summary);
    };
    const finishError = (error: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      clearInterval(poll);
      browser.runtime.onMessage.removeListener(listener);
      reject(error);
    };
    const listener = (message: unknown): false | undefined => {
      if (!isTaskEvent(message, taskId)) return false;
      onUpdate?.(message.event);
      if (isTerminal(message.event.status)) finish(message.event as BrowserTaskSummary);
      return false;
    };
    browser.runtime.onMessage.addListener(listener);
    if (start) {
      void start()
        .then((response) => {
          if (response.success === false) {
            finishError(new Error(response.error || '任务启动失败'));
          }
        })
        .catch(finishError);
    }
  });
}

function isTerminal(status: unknown): boolean {
  return status === 'completed' || status === 'failed' || status === 'stopped';
}

function isTaskEvent(
  message: unknown,
  taskId: string
): message is { event: Partial<BrowserTaskSummary> } {
  return (
    isRecord(message) &&
    message.type === 'BROWSER_TASK_EVENT' &&
    message.taskId === taskId &&
    isRecord(message.event)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
