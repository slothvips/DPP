import { browser } from 'wxt/browser';
import { MultiPageAgent } from '@/lib/pageAgent/multiPageAgent';
import type { PageAgentTaskMessage, PageAgentTaskSummary } from '@/lib/pageAgent/multiPageTypes';
import { PAGE_AGENT_TASK_STORAGE_KEY } from '@/lib/pageAgent/multiPageTypes';
import { pageAgentProxyFetch } from '@/lib/pageAgent/pageAgentProxyFetch';
import { resolvePageAgentApiKey } from '@/lib/pageAgent/types';
import type { PageAgentConfig } from '@/lib/pageAgent/types';

let activeAgent: MultiPageAgent | null = null;
let activeTaskId: string | null = null;
let stopRequestedTaskId: string | null = null;

void browser.storage.session.set({ __dpp_page_agent_host_ready: true });

browser.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (!isTaskMessage(message)) return false;
  void handleTaskMessage(message)
    .then(sendResponse)
    .catch((error: unknown) => {
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  return true;
});

async function handleTaskMessage(message: PageAgentTaskMessage): Promise<unknown> {
  if (message.type === 'PAGE_AGENT_TASK_START') return startTask(message);
  if (message.type === 'PAGE_AGENT_TASK_STOP') {
    if (activeTaskId === message.taskId && activeAgent) {
      stopRequestedTaskId = message.taskId;
      await updateSummary({ status: 'stopping' });
      await activeAgent.stop();
    }
    return { success: true };
  }
  const summary = await readSummary();
  if (
    message.type === 'PAGE_AGENT_TASK_GET_STATUS' ||
    message.type === 'PAGE_AGENT_TASK_SUBSCRIBE'
  ) {
    return summary?.taskId === message.taskId ? summary : { success: false, error: '任务不存在' };
  }
  return { success: true };
}

async function startTask(
  message: Extract<PageAgentTaskMessage, { type: 'PAGE_AGENT_TASK_START' }>
) {
  if (activeAgent) return { success: false, error: '已有 PageAgent 任务正在执行' };
  const configResponse = (await browser.runtime.sendMessage({ type: 'PAGE_AGENT_GET_CONFIG' })) as {
    success?: boolean;
    config?: PageAgentConfig;
    error?: string;
  };
  if (!configResponse.success || !configResponse.config) {
    return { success: false, error: configResponse.error || 'PageAgent 配置不可用' };
  }
  activeTaskId = message.taskId;
  stopRequestedTaskId = null;
  const taskId = message.taskId;
  await writeSummary({
    taskId,
    sessionId: message.sessionId,
    task: message.task,
    initialTabId: message.initialTabId,
    status: 'running',
    history: [],
    updatedAt: Date.now(),
  });

  try {
    const config = configResponse.config;
    activeAgent = new MultiPageAgent({
      baseURL: config.baseUrl,
      apiKey: resolvePageAgentApiKey(config.apiKey),
      model: config.model,
      language: 'zh-CN',
      // PageAgent defaults to 40 steps. Use an explicit large ceiling so long tasks
      // do not silently fall back to the library default.
      // Retry transient LLM/network failures without restarting the whole task.
      maxRetries: 3,
      maxSteps: 1_000_000,
      initialTabId: message.initialTabId,
      groupName: message.groupName,
      customFetch: (input, options) => pageAgentProxyFetch(input, options, taskId),
      onAfterStep: async (_agent, history) =>
        updateSummary({
          history,
          status: 'running',
        }),
    });
    activeAgent.addEventListener('activity', (event: Event) => {
      const activity = (event as CustomEvent<unknown>).detail;
      void updateSummary({ activity });
    });
    void runTask(taskId, message);
    return { success: true, taskId };
  } catch (error) {
    await writeSummary({
      taskId,
      sessionId: message.sessionId,
      task: message.task,
      initialTabId: message.initialTabId,
      status: 'failed',
      history: [],
      error: error instanceof Error ? error.message : String(error),
      updatedAt: Date.now(),
    });
    activeAgent?.dispose();
    activeAgent = null;
    activeTaskId = null;
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function updateSummary(update: Partial<PageAgentTaskSummary>): Promise<void> {
  const summary = await readSummary();
  if (summary && summary.taskId === activeTaskId)
    await writeSummary({ ...summary, ...update, updatedAt: Date.now() });
}

async function runTask(
  taskId: string,
  message: Extract<PageAgentTaskMessage, { type: 'PAGE_AGENT_TASK_START' }>
): Promise<void> {
  try {
    const result = await activeAgent?.execute(message.task);
    if (!result) throw new Error('PageAgent 未启动');
    const stopped = stopRequestedTaskId === taskId;
    await writeSummary({
      taskId,
      sessionId: message.sessionId,
      task: message.task,
      initialTabId: message.initialTabId,
      status: stopped ? 'stopped' : result.success ? 'completed' : 'failed',
      history: result.history,
      result: { success: result.success, data: result.data },
      updatedAt: Date.now(),
    });
    await browser.runtime.sendMessage({
      type: 'PAGE_AGENT_TASK_RESULT',
      taskId,
      result: { success: result.success, data: result.data },
    });
  } catch (error) {
    const stopped = stopRequestedTaskId === taskId;
    await writeSummary({
      taskId,
      task: message.task,
      initialTabId: message.initialTabId,
      status: stopped ? 'stopped' : 'failed',
      history: [],
      error: error instanceof Error ? error.message : String(error),
      updatedAt: Date.now(),
    });
  } finally {
    activeAgent?.dispose();
    activeAgent = null;
    activeTaskId = null;
    stopRequestedTaskId = null;
  }
}

async function readSummary(): Promise<PageAgentTaskSummary | undefined> {
  const result = await browser.storage.session.get(PAGE_AGENT_TASK_STORAGE_KEY);
  return result[PAGE_AGENT_TASK_STORAGE_KEY] as PageAgentTaskSummary | undefined;
}

async function writeSummary(summary: PageAgentTaskSummary): Promise<void> {
  await browser.storage.session.set({ [PAGE_AGENT_TASK_STORAGE_KEY]: summary });
  await browser.runtime.sendMessage({
    type: 'PAGE_AGENT_TASK_EVENT',
    taskId: summary.taskId,
    event: summary,
  });
}

function isTaskMessage(message: unknown): message is PageAgentTaskMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    String(message.type).startsWith('PAGE_AGENT_TASK_')
  );
}
