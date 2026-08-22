import { browser } from 'wxt/browser';
import { createToolParameter, toolRegistry } from '@/lib/ai/tools';
import type { ToolHandler } from '@/lib/ai/tools';
import type { BrowserTaskSummary } from '@/lib/browserTask/types';
import { BROWSER_TASK_GROUP_STORAGE_KEY, BROWSER_TASK_STORAGE_KEY } from '@/lib/browserTask/types';

let activeTaskId: string | null = null;

const MAX_TASK_RESULT_LENGTH = 2000;

export async function executeBrowserTask(args: {
  task: string;
  group_name: string;
  session_id?: string;
  resume_task_id?: string;
  onUpdate?: (event: Partial<BrowserTaskSummary>) => void;
}): Promise<{ success: boolean; message: string; task_id: string }> {
  const tab = await getActiveTab();
  if (!tab) return { success: false, message: '当前活动页面无法运行网页助手', task_id: '' };
  const taskId = crypto.randomUUID();
  activeTaskId = taskId;

  try {
    const response = (await browser.runtime.sendMessage({
      type: 'BROWSER_TASK_START',
      taskId,
      task: args.task,
      sessionId: args.session_id,
      groupName: args.group_name,
      initialTabId: tab,
      resumeTaskId: args.resume_task_id,
    })) as { success?: boolean; error?: string };
    if (!response.success)
      return { success: false, message: response.error || '任务启动失败', task_id: taskId };
    const summary = await waitForTask(taskId, args.onUpdate);
    const rawMessage = summary.result || summary.error || '任务未完成';
    return {
      success: summary.status === 'completed',
      message: rawMessage.slice(0, MAX_TASK_RESULT_LENGTH),
      task_id: taskId,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
      task_id: taskId,
    };
  } finally {
    activeTaskId = null;
  }
}

export async function stopActiveBrowserTask(): Promise<void> {
  const taskId = await resolveActiveTaskId();
  if (taskId) await browser.runtime.sendMessage({ type: 'BROWSER_TASK_STOP', taskId });
}

async function resolveActiveTaskId(): Promise<string | null> {
  if (activeTaskId) return activeTaskId;
  const stored = await browser.storage.session.get(BROWSER_TASK_STORAGE_KEY);
  const summary = stored[BROWSER_TASK_STORAGE_KEY];
  if (
    typeof summary === 'object' &&
    summary !== null &&
    'taskId' in summary &&
    typeof summary.taskId === 'string' &&
    'status' in summary &&
    (summary.status === 'running' || summary.status === 'waiting_user')
  ) {
    return summary.taskId;
  }
  return null;
}

export async function resetBrowserTaskGroup(): Promise<void> {
  await browser.storage.session.remove(BROWSER_TASK_GROUP_STORAGE_KEY);
}

export function registerBrowserTaskTools(): void {
  toolRegistry.register({
    name: 'browser_execute_task',
    description:
      '在浏览器中执行一个明确、范围受限的网页子任务（观察、点击、填写、选择、滚动、跨标签页操作），执行后返回结果摘要和 task_id。你是规划者，把复杂目标拆成小任务逐个执行；失败后用返回的 task_id 作为 resume_task_id 从断点重试。',
    parameters: createToolParameter(
      {
        task: {
          type: 'string',
          description: '要执行的子任务：做什么、在哪个页面、期望结果、何时完成',
        },
        group_name: { type: 'string', description: '任务标签页分组名称' },
        resume_task_id: {
          type: 'string',
          description: '可选。上次失败任务的 ID，传入后从断点继续而不是重新开始',
        },
      },
      ['task', 'group_name']
    ),
    handler: executeBrowserTask as ToolHandler,
    requiresConfirmation: true,
  });
}

async function getActiveTab(): Promise<number | null> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url?.startsWith('http')) return null;
  return tab.id;
}

async function waitForTask(
  taskId: string,
  onUpdate?: (event: Partial<BrowserTaskSummary>) => void
): Promise<BrowserTaskSummary> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(
      () => {
        // 超时同时停止宿主端任务，避免后台继续空转
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
    void browser.runtime
      .sendMessage({ type: 'BROWSER_TASK_SUBSCRIBE', taskId })
      .then((response: unknown) => {
        if (isSummary(response, taskId) && isTerminal(response.status)) finish(response);
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
function isSummary(message: unknown, taskId: string): message is BrowserTaskSummary {
  return isRecord(message) && message.taskId === taskId && typeof message.status === 'string';
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
