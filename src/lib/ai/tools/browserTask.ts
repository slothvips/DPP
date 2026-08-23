import { browser } from 'wxt/browser';
import { createToolParameter, toolRegistry } from '@/lib/ai/tools';
import type { ToolHandler } from '@/lib/ai/tools';
import type { BrowserTaskStopSource, BrowserTaskSummary } from '@/lib/browserTask/types';

const MAX_TASK_RESULT_LENGTH = 2000;
const taskIdsBySession = new Map<string, Set<string>>();

export async function delegateBrowserAgent(args: {
  task: string;
  session_id?: string;
  tool_call_id?: string;
  onUpdate?: (event: Partial<BrowserTaskSummary>) => void;
}): Promise<{ success: boolean; message: string }> {
  const tab = await getActiveTab();
  if (!tab) return { success: false, message: '当前活动页面无法运行网页助手' };
  const taskId = crypto.randomUUID();
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
          initialTabId: tab,
        }) as Promise<{ success?: boolean; error?: string }>
    );
    return {
      success: summary.status === 'completed',
      message: (summary.result || summary.error || '任务未完成').slice(0, MAX_TASK_RESULT_LENGTH),
    };
  } catch (error) {
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
      browser.runtime.sendMessage({ type: 'BROWSER_TASK_STOP', taskId, source })
    )
  );
}

export function registerBrowserTaskTools(): void {
  toolRegistry.register({
    name: 'delegate_browser_agent',
    description:
      '接受 D 仔委派的网页任务，独立执行并在完成后向 D 仔汇报结果。只能处理当前任务，不得扩展目标。',
    parameters: createToolParameter(
      {
        task: {
          type: 'string',
          description: '交给浏览器子 Agent 的网页任务目标和完成标准',
        },
      },
      ['task']
    ),
    handler: delegateBrowserAgent as ToolHandler,
    requiresConfirmation: true,
  });
}

async function getActiveTab(): Promise<number | null> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (typeof tab?.id !== 'number' || !tab.url?.startsWith('http')) return null;
  return tab.id;
}

async function waitForTask(
  taskId: string,
  onUpdate: ((event: Partial<BrowserTaskSummary>) => void) | undefined,
  start: () => Promise<{ success?: boolean; error?: string }>
): Promise<BrowserTaskSummary> {
  return new Promise((resolve, reject) => {
    let settled = false;
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
      browser.runtime.onMessage.removeListener(listener);
      resolve(summary);
    };
    const finishError = (error: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
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
    void start()
      .then((response) => {
        if (response.success === false) {
          finishError(new Error(response.error || '任务启动失败'));
        }
      })
      .catch(finishError);
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
