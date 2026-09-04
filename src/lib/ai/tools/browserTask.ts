import { browser } from 'wxt/browser';
import { createToolParameter, toolRegistry } from '@/lib/ai/tools';
import type { ToolHandler } from '@/lib/ai/tools';
import type { BrowserTaskStopSource, BrowserTaskSummary } from '@/lib/browserTask/types';
import {
  deleteBrowserTaskRecord,
  getBrowserTaskRecord,
  reserveBrowserTask,
} from '@/lib/db/browserTasks';
import type { PageControlMessage } from '@/lib/pageAgent/multiPageTypes';
import { redactSensitiveText } from '@/utils/sensitive';

const MAX_TASK_RESULT_LENGTH = 2000;
const TASK_QUEUE_TIMEOUT_MS = 5 * 60 * 1000;
const taskIdsBySession = new Map<string, Set<string>>();
const testTabsByTarget = new Map<string, number>();

export type BrowserTaskFailureReason =
  | 'invalid_request'
  | 'resource_conflict'
  | 'page_unavailable'
  | 'page_load_timeout'
  | 'task_timeout'
  | 'execution_failed'
  | 'stopped';

export interface BrowserTaskToolResult {
  success: boolean;
  message: string;
  failure_reason?: BrowserTaskFailureReason;
  retryable?: boolean;
  browser_task_id?: string;
  test_step_result?: BrowserTaskSummary['testStepResult'];
  test_step_attempts?: BrowserTaskSummary['testStepAttempts'];
}

export interface BrowserTabInfo {
  tabId: number;
  title: string;
  url: string;
  windowId: number;
  active: boolean;
  is_current: boolean;
}

function getTestTabKey(sessionId: string, testRunId: string, targetId: string): string {
  return `${sessionId}\0${testRunId}\0${targetId}`;
}

export function releaseTestBrowserTabs(sessionId: string, testRunId: string): void {
  const prefix = `${sessionId}\0${testRunId}\0`;
  for (const key of testTabsByTarget.keys()) {
    if (key.startsWith(prefix)) testTabsByTarget.delete(key);
  }
}

export async function delegateBrowserAgent(args: {
  task: string;
  tab_id?: number;
  initial_url?: string;
  open_new_tab?: boolean;
  resource_keys?: string[];
  test_target_id?: string;
  test_run_id?: string;
  session_id?: string;
  tool_call_id?: string;
  onUpdate?: (event: Partial<BrowserTaskSummary>) => void;
}): Promise<BrowserTaskToolResult> {
  if (args.test_target_id?.trim() && !args.test_run_id?.trim()) {
    return createBrowserTaskFailure('测试步骤缺少测试执行 ID', 'invalid_request');
  }
  if (args.tab_id === undefined && !isInjectableUrl(args.initial_url)) {
    return createBrowserTaskFailure(
      '必须指定与任务相关的标签页 ID 或明确的 HTTP(S) 初始 URL',
      'invalid_request'
    );
  }
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
        return createBrowserTaskToolResult(existing.summary);
      }
      return waitForTask(existing.taskId, args.onUpdate, undefined).then(
        createBrowserTaskToolResult
      );
    }
  }
  const testTabKey =
    args.session_id?.trim() && args.test_run_id?.trim() && args.test_target_id?.trim()
      ? getTestTabKey(args.session_id.trim(), args.test_run_id.trim(), args.test_target_id.trim())
      : undefined;
  const target = await getTargetTab(args.tab_id, args.initial_url, args.open_new_tab, testTabKey);
  if (!target) {
    if (reservationCreated) await deleteBrowserTaskRecord(taskId);
    return createBrowserTaskFailure('没有可运行网页助手的 HTTP(S) 标签页', 'page_unavailable');
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
          initialUrl: target.url,
          closeInitialTab: target.created && !testTabKey,
          resultMode: args.test_target_id ? 'test-step' : undefined,
          resourceKeys: normalizeResourceKeys(args.resource_keys, target.url, args.test_target_id),
        }) as Promise<{ success?: boolean; error?: string; queued?: boolean }>
    );
    return createBrowserTaskToolResult(summary);
  } catch (error) {
    if (reservationCreated) await deleteBrowserTaskRecord(taskId);
    if (target.created && !testTabKey) {
      await browser.tabs.remove(target.tabId).catch(() => undefined);
    }
    const message = error instanceof Error ? error.message : String(error);
    return createBrowserTaskFailure(message, classifyBrowserTaskFailure(message));
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

export async function listBrowserTabs(): Promise<BrowserTabInfo[]> {
  const [tabs, currentTabs] = await Promise.all([
    browser.tabs.query({}),
    browser.tabs.query({ active: true, lastFocusedWindow: true }),
  ]);
  const currentTabId = currentTabs.find((tab) => typeof tab.id === 'number')?.id;

  return tabs.flatMap((tab) => {
    if (
      typeof tab.id !== 'number' ||
      typeof tab.windowId !== 'number' ||
      !isInjectableUrl(tab.url)
    ) {
      return [];
    }
    return [
      {
        tabId: tab.id,
        title: tab.title || '',
        url: tab.url,
        windowId: tab.windowId,
        active: tab.active === true,
        is_current: tab.id === currentTabId,
      },
    ];
  });
}

async function pageRead(args: { tab_id?: number; max_chars?: number }) {
  const tab =
    args.tab_id === undefined
      ? (await browser.tabs.query({ active: true, lastFocusedWindow: true }))[0]
      : await browser.tabs.get(args.tab_id);
  if (typeof tab?.id !== 'number' || !isInjectableUrl(tab.url)) {
    throw new Error('没有可读取的 HTTP(S) 标签页');
  }
  const message: PageControlMessage = {
    type: 'PAGE_AGENT_PAGE_CONTROL',
    action: 'read_page',
    targetTabId: tab.id,
    payload: [Math.min(Math.max(1_000, args.max_chars ?? 10_000), 20_000)],
  };
  let response: unknown;
  try {
    response = await browser.tabs.sendMessage(tab.id, message);
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !/Receiving end does not exist|Could not establish connection/i.test(error.message)
    ) {
      throw error;
    }
    await browser.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['/content-scripts/pageAgentController.js'],
    });
    response = await browser.tabs.sendMessage(tab.id, message);
  }
  if (!isRecord(response) || response.success === false || !isRecord(response.data)) {
    throw new Error(
      isRecord(response) && typeof response.error === 'string' ? response.error : '页面读取失败'
    );
  }
  const data = response.data;
  return {
    tab_id: tab.id,
    title: typeof data.title === 'string' ? data.title : tab.title || '',
    url: redactSensitiveText(typeof data.url === 'string' ? data.url : tab.url),
    selected_text:
      typeof data.selectedText === 'string' ? redactSensitiveText(data.selectedText) : '',
    content: typeof data.content === 'string' ? redactSensitiveText(data.content) : '',
    truncated: data.truncated === true,
  };
}

export function registerBrowserTaskTools(): void {
  toolRegistry.register({
    name: 'delegate_browser_agent',
    description:
      '接受 D 仔委派的网页任务，在指定标签页中执行并在完成后向 D 仔汇报结果。后台标签页会直接复用；如果指定的是用户当前聚焦页，则会复制为后台任务页。',
    parameters: createToolParameter(
      {
        task: {
          type: 'string',
          description: '交给浏览器子 Agent 的网页任务目标和完成标准',
        },
        tab_id: {
          type: 'integer',
          description:
            '目标网页的标签页 ID；后台标签页直接复用，用户当前聚焦页会复制为不抢焦点的任务标签页',
        },
        initial_url: {
          type: 'string',
          description: '未提供 tab_id 时用于创建任务标签页的明确 HTTP(S) 目标 URL',
        },
        open_new_tab: {
          type: 'boolean',
          description:
            '明确需要隔离的新标签页时设为 true；必须同时提供 initial_url。默认不创建新标签页',
        },
        test_target_id: {
          type: 'string',
          description: '测试用例步骤所属的目标网页 ID；执行测试用例步骤时必须提供',
        },
        test_run_id: {
          type: 'string',
          description: '当前测试执行记录 ID；执行测试用例步骤时必须提供，用于隔离标签页复用范围',
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
    description:
      '列出当前可操作的 HTTP(S) 标签页，并标记每个窗口的活动页以及浏览器当前聚焦窗口中的活动页（is_current）。',
    parameters: createToolParameter({}),
    handler: listBrowserTabs as ToolHandler,
  });
  toolRegistry.register({
    name: 'page_read',
    description:
      '读取当前或指定 HTTP(S) 标签页的标题、选中文本和可见正文。只读操作，不返回输入框值。',
    parameters: createToolParameter(
      {
        tab_id: {
          type: 'integer',
          description: '标签页 ID；不提供时读取浏览器当前聚焦窗口的活动页',
        },
        max_chars: {
          type: 'integer',
          minimum: 1_000,
          maximum: 20_000,
          description: '正文最大字符数，默认 10000',
        },
      },
      []
    ),
    handler: pageRead as ToolHandler,
    requiresConfirmation: true,
  });
}

async function getTargetTab(
  tabId?: number,
  initialUrl?: string,
  openNewTab = false,
  testTabKey?: string
): Promise<{ tabId: number; url: string; created: boolean } | null> {
  if (openNewTab) {
    if (!initialUrl || !isInjectableUrl(initialUrl)) return null;
    const reusableTabId = testTabKey ? testTabsByTarget.get(testTabKey) : undefined;
    if (reusableTabId !== undefined) {
      const reusableTab = await browser.tabs.get(reusableTabId).catch(() => null);
      if (reusableTab && isInjectableUrl(reusableTab.url)) {
        return { tabId: reusableTabId, url: reusableTab.url, created: false };
      }
      if (testTabKey) testTabsByTarget.delete(testTabKey);
    }
    try {
      const created = await browser.tabs.create({ url: initialUrl, active: false });
      if (typeof created.id !== 'number') return null;
      if (testTabKey) testTabsByTarget.set(testTabKey, created.id);
      return { tabId: created.id, url: initialUrl, created: true };
    } catch {
      return null;
    }
  }

  try {
    if (tabId !== undefined) {
      const tab = await browser.tabs.get(tabId);
      if (typeof tab.id !== 'number' || !isInjectableUrl(tab.url)) return null;

      const currentTabs = await browser.tabs.query({ active: true, lastFocusedWindow: true });
      const isUserFocusedTab = currentTabs.some((currentTab) => currentTab.id === tab.id);
      if (!isUserFocusedTab) return { tabId: tab.id, url: tab.url, created: false };

      try {
        const created = await browser.tabs.create({
          url: tab.url,
          ...(typeof tab.windowId === 'number' ? { windowId: tab.windowId } : {}),
          active: false,
        });
        return typeof created.id === 'number'
          ? { tabId: created.id, url: tab.url, created: true }
          : null;
      } catch {
        return null;
      }
    }
    if (!initialUrl || !isInjectableUrl(initialUrl)) return null;
    const created = await browser.tabs.create({ url: initialUrl, active: false });
    return typeof created.id === 'number'
      ? { tabId: created.id, url: initialUrl, created: true }
      : null;
  } catch {
    return null;
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
  start?: () => Promise<{ success?: boolean; error?: string; queued?: boolean }>
): Promise<BrowserTaskSummary> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let queueTimeout: ReturnType<typeof setTimeout> | undefined;
    const clearQueueTimeout = () => {
      if (queueTimeout !== undefined) {
        clearTimeout(queueTimeout);
        queueTimeout = undefined;
      }
    };
    const startQueueTimeout = () => {
      if (queueTimeout !== undefined) return;
      queueTimeout = setTimeout(() => {
        void browser.runtime.sendMessage({ type: 'BROWSER_TASK_STOP', taskId, source: 'timeout' });
        finishError(new Error('网页任务排队超时：浏览器资源持续冲突'));
      }, TASK_QUEUE_TIMEOUT_MS);
    };
    const poll = setInterval(() => {
      void getBrowserTaskRecord(taskId)
        .then((record) => {
          if (!record) return;
          onUpdate?.(record.summary);
          if (record.summary.status === 'queued') startQueueTimeout();
          else clearQueueTimeout();
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
      clearQueueTimeout();
      clearInterval(poll);
      browser.runtime.onMessage.removeListener(listener);
      resolve(summary);
    };
    const finishError = (error: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      clearQueueTimeout();
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
          } else if (response.queued) {
            startQueueTimeout();
          }
        })
        .catch(finishError);
    }
  });
}

function isTerminal(status: unknown): boolean {
  return status === 'completed' || status === 'failed' || status === 'stopped';
}

function createBrowserTaskToolResult(summary: BrowserTaskSummary): BrowserTaskToolResult {
  const message = (summary.result || summary.error || '任务未完成').slice(
    0,
    MAX_TASK_RESULT_LENGTH
  );
  if (summary.status === 'completed') {
    return {
      success: true,
      message,
      browser_task_id: summary.taskId,
      ...(summary.testStepResult ? { test_step_result: summary.testStepResult } : {}),
      ...(summary.testStepAttempts ? { test_step_attempts: summary.testStepAttempts } : {}),
    };
  }
  return {
    ...createBrowserTaskFailure(
      message,
      summary.status === 'stopped' ? 'stopped' : classifyBrowserTaskFailure(message)
    ),
    browser_task_id: summary.taskId,
    ...(summary.testStepResult ? { test_step_result: summary.testStepResult } : {}),
    ...(summary.testStepAttempts ? { test_step_attempts: summary.testStepAttempts } : {}),
  };
}

function createBrowserTaskFailure(
  message: string,
  reason: BrowserTaskFailureReason
): BrowserTaskToolResult {
  return {
    success: false,
    message: message.slice(0, MAX_TASK_RESULT_LENGTH),
    failure_reason: reason,
    retryable:
      reason === 'resource_conflict' ||
      reason === 'page_unavailable' ||
      reason === 'page_load_timeout',
  };
}

function classifyBrowserTaskFailure(message: string): BrowserTaskFailureReason {
  if (/资源.*冲突|排队超时/.test(message)) return 'resource_conflict';
  if (/加载超时/.test(message)) return 'page_load_timeout';
  if (/执行超时/.test(message)) return 'task_timeout';
  if (/无法运行|不受支持|标签页.*已关闭|无法打开/.test(message)) return 'page_unavailable';
  return 'execution_failed';
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
