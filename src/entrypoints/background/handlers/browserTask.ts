import { browser } from 'wxt/browser';
import { createConfiguredProvider } from '@/lib/ai/config';
import type { ChatMessage, OpenAIToolCall, OpenAIToolDefinition } from '@/lib/ai/types';
import { areBrowserUrlsEqual, parseBrowserTaskArguments } from '@/lib/browserTask/arguments';
import { isTaskGroupTitle, toTaskGroupTitle } from '@/lib/browserTask/groupTitle';
import { BrowserRuntime } from '@/lib/browserTask/runtime';
import { buildActionRecord } from '@/lib/browserTask/stepRecord';
import type {
  BrowserAction,
  BrowserActionState,
  BrowserSnapshot,
  BrowserTabState,
  BrowserTaskCheckpoint,
  BrowserTaskMessage,
  BrowserTaskState,
  BrowserTaskSummary,
} from '@/lib/browserTask/types';
import {
  BROWSER_TASK_CHECKPOINT_STORAGE_KEY,
  BROWSER_TASK_FOLLOW_STORAGE_KEY,
  BROWSER_TASK_STORAGE_KEY,
} from '@/lib/browserTask/types';
import { logger } from '@/utils/logger';
import { isAllowedProtocol } from '@/utils/urlSafety';

let activeTask: {
  taskId: string;
  controller: AbortController;
  resume?: () => void;
  resolveDone: () => void;
  done: Promise<void>;
} | null = null;

export async function recoverInterruptedBrowserTask(): Promise<void> {
  const summary = await readSummary();
  if (!summary || !['running', 'waiting_user'].includes(summary.status)) return;

  const checkpoint = await readCheckpoint(summary.taskId);
  const ownedTabIds = checkpoint?.ownedTabIds || [summary.initialTabId];
  await Promise.all(
    ownedTabIds.map(async (tabId) => {
      try {
        await browser.runtime.sendMessage({
          type: 'BROWSER_CONTROL',
          action: 'set_locked',
          targetTabId: tabId,
          payload: { locked: false },
        });
      } catch (error) {
        logger.debug(`[BrowserTask] Failed to unlock recovered tab ${tabId}:`, error);
      }
    })
  );

  await writeSummary({
    ...summary,
    status: 'stopped',
    error: '浏览器后台重新启动，网页任务已停止，请从断点重试',
  });
}

export async function handleBrowserTaskMessage(message: BrowserTaskMessage): Promise<unknown> {
  if (message.type === 'BROWSER_TASK_START') return startTask(message);
  if (message.type === 'BROWSER_TASK_STOP') {
    if (activeTask?.taskId === message.taskId) {
      activeTask.resume?.();
      activeTask.controller.abort();
      await activeTask.done;
    }
    return { success: true };
  }
  if (message.type === 'BROWSER_TASK_RESUME') {
    if (activeTask?.taskId === message.taskId) activeTask.resume?.();
    return { success: true };
  }
  const summary = await readSummary();
  if (summary?.taskId !== message.taskId) return { success: false, error: '任务不存在' };
  return summary;
}

async function startTask(message: Extract<BrowserTaskMessage, { type: 'BROWSER_TASK_START' }>) {
  if (activeTask) {
    const currentSummary = await readSummary();
    if (currentSummary?.taskId === activeTask.taskId && isTerminalStatus(currentSummary.status)) {
      await activeTask.done;
    } else {
      return { success: false, error: '已有网页任务正在执行' };
    }
  }
  if (activeTask) return { success: false, error: '已有网页任务正在执行' };
  const controller = new AbortController();
  let resolveDone: () => void = () => undefined;
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });
  activeTask = { taskId: message.taskId, controller, done, resolveDone };
  const summary: BrowserTaskSummary = {
    taskId: message.taskId,
    sessionId: message.sessionId,
    task: message.task,
    groupName: message.groupName,
    initialTabId: message.initialTabId,
    status: 'running',
    history: [],
    updatedAt: Date.now(),
  };
  try {
    await writeSummary(summary);
  } catch (error) {
    activeTask = null;
    resolveDone();
    throw error;
  }
  // Keep the runtime message open while the task runs so MV3 does not suspend
  // the service worker immediately after acknowledging the task start.
  await runTask(message, controller.signal);
  return { success: true, taskId: message.taskId };
}

async function runTask(
  message: Extract<BrowserTaskMessage, { type: 'BROWSER_TASK_START' }>,
  signal: AbortSignal
) {
  const trackedTabs = new Set([message.initialTabId]);
  const ownedTabs = new Set([message.initialTabId]);
  let visitedUrls = new Set<string>();
  const recentActions: BrowserActionState[] = [];
  let lockListener: ((tabId: number, changeInfo: { status?: string }) => void) | null = null;
  const lockController = new AbortController();
  try {
    const { provider } = await createConfiguredProvider({
      includeLegacyFallback: false,
      logPrefix: '[BrowserTask]',
    });
    let currentTabId = message.initialTabId;
    const checkpoint = message.resumeTaskId
      ? await readCheckpoint(message.resumeTaskId)
      : undefined;
    const groupId = await createTaskGroup(message.initialTabId, message.groupName || message.task);
    lockListener = (tabId, changeInfo) => {
      if (changeInfo.status === 'complete' && ownedTabs.has(tabId)) {
        void lockTabWithRetry(tabId, lockController.signal);
      }
    };
    browser.tabs.onUpdated.addListener(lockListener);
    const tools = createTools();
    if (checkpoint) {
      trackedTabs.clear();
      ownedTabs.clear();
      const availableTabs = await restoreCheckpointTabs(checkpoint, trackedTabs);
      if (!availableTabs.has(checkpoint.currentTabId)) {
        throw new Error(`断点当前标签页 ${checkpoint.currentTabId} 已不可用，无法恢复任务`);
      }
      currentTabId = checkpoint.currentTabId;
      visitedUrls = new Set(checkpoint.visitedUrls);
      recentActions.push(...checkpoint.recentActions);
      const checkpointOwnedTabs = new Set(
        checkpoint.ownedTabIds || checkpoint.tabs.map((tab) => tab.id)
      );
      for (const tabId of availableTabs) {
        if (checkpointOwnedTabs.has(tabId)) ownedTabs.add(tabId);
      }
    }
    await discoverWindowTabs(message.initialTabId, trackedTabs);
    for (const tabId of ownedTabs) await setTabLocked(tabId, true).catch(() => undefined);
    const initialState = await buildTaskState(
      currentTabId,
      trackedTabs,
      visitedUrls,
      recentActions
    );
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content:
          '你是 DPP 网页任务执行器。主线 AI 会给你一个明确、范围受限的子任务，你的职责是忠实执行并尽快完成，不要延伸任务范围，不要重复已完成动作。每轮只执行一个浏览器动作，一次返回多个动作会被拒绝执行。每个工具结果都附带最新完整状态（currentTabId、tabs、page、recentActions、visitedUrls），这是下一步决策的唯一依据。每次行动前检查 tabs：目标网址已在任务标签页中时必须 browser_switch_tab，不能再次 browser_open_tab；当前页面已是目标网址时继续操作，不能重复 browser_navigate。readiness.stable 为 false 时页面仍在加载，先 browser_observe，不能重复打开或导航。状态在页面加载和网络稳定后才采集，可直接信任其中的元素；若结果与预期不符，用 browser_observe 重新确认。元素用最新 page.elements 的 index 定位，页面变化后旧 index 立即失效，不能复用。recentActions 记录每个动作的前后 URL、标签页切换（switchedToTabId）和导航信息（navigatedFrom/To），结合 visitedUrls 判断哪些内容已处理，不要重复访问已访问的 URL。点击可能自动打开并切换到新标签页，一切以返回状态中的 currentTabId 为准。长内容逐屏浏览用 browser_scroll_page，触发懒加载用 browser_scroll_to_bottom，定位到指定位置用 browser_scroll_to_percent 或 browser_scroll_to_text，提交搜索框用 browser_fill 后 browser_send_keys 发送 Enter，下拉框选项不确定时先用 browser_get_dropdown_options。当前页内跳转用 browser_navigate，返回上一页用 browser_go_back；两者都只支持 http/https。子任务目标达成后立即调用 browser_done，result 用几句话简洁报告结果和关键数据，不要冗长复述过程。',
      },
      {
        role: 'user',
        content: `${checkpoint ? buildResumeMessage(checkpoint) : message.task}\n\n当前浏览器状态：\n${JSON.stringify(initialState)}`,
      },
    ];
    for (let step = 0; step < 200; step += 1) {
      if (signal.aborted) throw new DOMException('网页任务已停止', 'AbortError');
      const response = await provider.chat(messages, {
        stream: false,
        tools,
        toolChoice: 'auto',
        signal,
      });
      messages.push({
        role: 'assistant',
        content: response.message.content || '',
        toolCalls: response.message.toolCalls,
      });
      const modelOutput = response.message.content?.trim();
      if (modelOutput) await updateSummary({ modelOutput });
      const calls = response.message.toolCalls || [];
      if (calls.length === 0) throw new Error('模型未返回网页动作');
      let completed: string | undefined;
      let lastState: BrowserTaskState | undefined;
      for (const call of calls) {
        const args = parseArguments(call);
        const beforeState = await buildTaskState(
          currentTabId,
          trackedTabs,
          visitedUrls,
          recentActions
        );
        let result: Record<string, unknown>;
        if (calls.length > 1) {
          result = { message: '每轮只允许执行一个浏览器动作，请根据这次状态重新选择下一步。' };
        } else {
          try {
            result = await executeTool(
              call.function.name,
              args,
              currentTabId,
              trackedTabs,
              ownedTabs,
              message.initialTabId,
              groupId,
              signal
            );
          } catch (error) {
            if (signal.aborted) throw error;
            result = {
              message: `动作失败：${error instanceof Error ? error.message : String(error)}`,
              error: true,
            };
          }
        }
        if (calls.length === 1 && result.error !== true && typeof result.tabId === 'number') {
          currentTabId = result.tabId;
        }
        if (
          calls.length === 1 &&
          call.function.name === 'browser_close_tab' &&
          Number(args.tabId) === currentTabId
        ) {
          currentTabId = message.initialTabId;
        }
        if (calls.length === 1 && call.function.name === 'browser_done')
          completed = String(args.result || result.message || '任务已完成');
        const afterState = await buildTaskState(
          currentTabId,
          trackedTabs,
          visitedUrls,
          recentActions
        );
        recentActions.push(
          buildActionRecord({
            action: call.function.name,
            message: String(result.message || ''),
            error: result.error === true,
            stateBefore: beforeState,
            stateAfter: afterState,
          })
        );
        while (recentActions.length > 8) recentActions.shift();
        const state = await buildTaskState(currentTabId, trackedTabs, visitedUrls, recentActions);
        lastState = state;
        messages.push({
          role: 'tool',
          content: JSON.stringify({ ...result, state }),
          toolCallId: call.id,
          name: call.function.name,
        });
      }
      if (calls.length === 1 && messages.length > 10) messages.splice(2, messages.length - 10);
      // 只广播轻量动作记录，页面快照只留在执行器自身上下文
      await updateSummary({ history: recentActions.slice(-8) });
      if (lastState) await saveCheckpoint(message.taskId, message.task, lastState, ownedTabs);
      if (completed) {
        if (signal.aborted) throw new DOMException('网页任务已停止', 'AbortError');
        await updateSummary({ status: 'completed', result: completed });
        await clearCheckpoint(message.taskId);
        return;
      }
    }
    throw new Error('网页任务超过最大动作数');
  } catch (error) {
    await updateSummary({
      status: signal.aborted ? 'stopped' : 'failed',
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    lockController.abort();
    for (const tabId of ownedTabs) await setTabLocked(tabId, false).catch(() => undefined);
    if (lockListener) browser.tabs.onUpdated.removeListener(lockListener);
    await BrowserRuntime.cleanup();
    const task = activeTask;
    activeTask = null;
    task?.resolveDone();
  }
}

function createTools(): OpenAIToolDefinition[] {
  const stringProperties = (properties: Record<string, string>, required: string[] = []) => ({
    type: 'object' as const,
    properties: Object.fromEntries(
      Object.entries(properties).map(([key, description]) => [key, { type: 'string', description }])
    ),
    required,
  });
  return [
    tool(
      'browser_observe',
      '刷新并返回完整浏览器状态：当前页、任务标签页、最近动作和已访问 URL。',
      stringProperties({})
    ),
    tool(
      'browser_click',
      '点击观察结果中的元素，使用元素的 index。',
      stringProperties({ index: '观察结果中的元素 index' }, ['index'])
    ),
    tool(
      'browser_fill',
      '填写观察结果中的输入字段，使用元素的 index。',
      stringProperties({ index: '观察结果中的元素 index', text: '要填写的内容' }, ['index', 'text'])
    ),
    tool(
      'browser_select',
      '选择观察结果中的下拉框选项，使用元素的 index。',
      stringProperties({ index: '观察结果中的元素 index', option: '选项文本或值' }, [
        'index',
        'option',
      ])
    ),
    tool(
      'browser_scroll',
      '滚动当前页面一屏。',
      stringProperties({ direction: 'up 或 down' }, ['direction'])
    ),
    tool(
      'browser_scroll_page',
      '按视口高度翻页式滚动当前页面，适合逐屏浏览长列表。',
      stringProperties({ direction: 'up 或 down' }, ['direction'])
    ),
    tool('browser_scroll_to_top', '滚动当前页面到顶部。', stringProperties({})),
    tool('browser_scroll_to_bottom', '滚动当前页面到底部，适合触发懒加载。', stringProperties({})),
    tool(
      'browser_scroll_to_percent',
      '滚动当前页面到指定百分比位置。',
      stringProperties({ percent: '0-100 的百分比数字' }, ['percent'])
    ),
    tool(
      'browser_scroll_to_text',
      '滚动到页面上包含指定文本的位置。',
      stringProperties({ text: '要查找的文本' }, ['text'])
    ),
    tool(
      'browser_send_keys',
      '向当前页面发送按键，例如 Enter、Escape、Control+A。用于提交搜索、关闭弹窗等。',
      stringProperties({ keys: '按键或组合键' }, ['keys'])
    ),
    tool(
      'browser_get_dropdown_options',
      '获取指定下拉框的全部可选项，用于选择前确认选项文本。',
      stringProperties({ index: '下拉框元素 index' }, ['index'])
    ),
    tool(
      'browser_navigate',
      '在当前标签页内导航到指定网址。当前页已经是目标网址时不要调用。',
      stringProperties({ url: '完整 URL' }, ['url'])
    ),
    tool(
      'browser_open_tab',
      '仅当任务标签页中没有目标网址时打开并切换到新标签页；已有目标网址必须使用 browser_switch_tab。',
      stringProperties({ url: '完整 URL' }, ['url'])
    ),
    tool(
      'browser_switch_tab',
      '切换到指定标签页。',
      stringProperties({ tabId: '标签页 ID' }, ['tabId'])
    ),
    tool(
      'browser_close_tab',
      '关闭任务期间创建的指定标签页；不能关闭任务开始前已有的标签页。',
      stringProperties({ tabId: '标签页 ID' }, ['tabId'])
    ),
    tool('browser_go_back', '在当前标签页返回上一页。', stringProperties({})),
    tool(
      'browser_request_user',
      '当需要用户登录、输入验证码、完成二次验证或处理权限时暂停任务并请求用户接管。',
      stringProperties({ reason: '需要用户完成的操作' }, ['reason'])
    ),
    tool(
      'browser_done',
      '报告网页任务完成。',
      stringProperties({ result: '完成结果' }, ['result'])
    ),
  ];
}

function tool(
  name: string,
  description: string,
  parameters: OpenAIToolDefinition['function']['parameters']
): OpenAIToolDefinition {
  return { type: 'function', function: { name, description, parameters } };
}

async function executeTool(
  name: string,
  args: Record<string, string>,
  tabId: number,
  trackedTabs: Set<number>,
  ownedTabs: Set<number>,
  initialTabId: number,
  groupId: number | null,
  signal?: AbortSignal
): Promise<Record<string, unknown>> {
  if (await isFollowEnabled()) await browser.tabs.update(tabId, { active: true });
  if (name === 'browser_observe') return { message: '已刷新浏览器状态' };
  if (name === 'browser_done') return { message: args.result };
  if (name === 'browser_request_user') {
    if (ownedTabs.has(tabId)) await setTabLocked(tabId, false);
    await updateSummary({ status: 'waiting_user', activity: args.reason });
    await waitForUser(signal);
    if (ownedTabs.has(tabId)) await setTabLocked(tabId, true);
    await updateSummary({ status: 'running', activity: undefined });
    return { message: '用户已完成接管操作，继续执行任务' };
  }
  const targetRuntime = new BrowserRuntime(tabId);
  if (name === 'browser_open_tab') {
    assertNavigableUrl(args.url);
    for (const trackedTabId of trackedTabs) {
      const trackedTab = await browser.tabs.get(trackedTabId).catch(() => null);
      if (trackedTab?.url && areBrowserUrlsEqual(trackedTab.url, args.url)) {
        await browser.tabs.update(trackedTabId, { active: true });
        if (ownedTabs.has(trackedTabId)) {
          await setTabLocked(trackedTabId, true).catch(() => undefined);
        }
        return {
          message: `目标网址已在标签页 ${trackedTabId} 打开，已直接切换`,
          tabId: trackedTabId,
        };
      }
    }
    const response = await browser.tabs.create({ url: args.url, active: true });
    if (response.id !== undefined) {
      trackedTabs.add(response.id);
      ownedTabs.add(response.id);
      if (groupId !== null) await addToTaskGroup(response.id, groupId);
      await setTabLocked(response.id, true).catch(() => undefined);
    }
    return { message: `已打开标签页 ${response.id}`, tabId: response.id };
  }
  if (name === 'browser_navigate') {
    assertNavigableUrl(args.url);
    const currentTab = await browser.tabs.get(tabId);
    if (currentTab.url && areBrowserUrlsEqual(currentTab.url, args.url)) {
      return { message: `当前标签页已经位于 ${args.url}，无需重复导航` };
    }
    const outcome = await targetRuntime.act('navigate', { url: args.url });
    return {
      message: outcome.message,
      ...(outcome.navigatedFrom !== undefined ? { navigatedFrom: outcome.navigatedFrom } : {}),
      ...(outcome.navigatedTo !== undefined ? { navigatedTo: outcome.navigatedTo } : {}),
    };
  }
  if (name === 'browser_switch_tab') {
    const targetTabId = Number(args.tabId);
    if (!trackedTabs.has(targetTabId)) throw new Error('只能切换到本次任务跟踪的标签页');
    await browser.tabs.update(targetTabId, { active: true });
    if (ownedTabs.has(targetTabId)) await setTabLocked(targetTabId, true);
    return { message: `已切换到标签页 ${args.tabId}`, tabId: targetTabId };
  }
  if (name === 'browser_close_tab') {
    const targetTabId = Number(args.tabId);
    if (!ownedTabs.has(targetTabId)) throw new Error('不能关闭任务开始前已有的标签页');
    if (targetTabId === initialTabId) throw new Error('不能关闭任务的起始标签页');
    await new BrowserRuntime(targetTabId).closeTab(initialTabId);
    trackedTabs.delete(targetTabId);
    ownedTabs.delete(targetTabId);
    return { message: `已关闭标签页 ${args.tabId}` };
  }
  const action = name.replace('browser_', '') as BrowserAction;
  const payload =
    action === 'scroll' || action === 'scroll_page'
      ? { ...args, direction: args.direction || 'down' }
      : args;
  const outcome = await targetRuntime.act(action, payload);
  if (outcome.newTabId !== undefined) {
    trackedTabs.add(outcome.newTabId);
    ownedTabs.add(outcome.newTabId);
    if (groupId !== null) await addToTaskGroup(outcome.newTabId, groupId);
    await setTabLocked(outcome.newTabId, true).catch(() => undefined);
    return { message: outcome.message, tabId: outcome.newTabId };
  }
  return { message: outcome.message, ...(outcome.data || {}) };
}

function assertNavigableUrl(url: string | undefined): void {
  if (!url || !isAllowedProtocol(url)) {
    throw new Error(`不允许访问的 URL：${url || '(空)'}`);
  }
}

async function buildTaskState(
  currentTabId: number,
  trackedTabs: Set<number>,
  visitedUrls: Set<string>,
  recentActions: BrowserActionState[]
): Promise<BrowserTaskState> {
  const tabs: BrowserTabState[] = [];
  for (const tabId of trackedTabs) {
    try {
      const tab = await browser.tabs.get(tabId);
      if (tab.id === undefined) continue;
      const url = tab.url || '';
      if (url) visitedUrls.add(url);
      tabs.push({
        id: tab.id,
        title: tab.title || '',
        url,
        isCurrent: tab.id === currentTabId,
      });
    } catch {
      trackedTabs.delete(tabId);
    }
  }
  const page = await observeWithRetry(currentTabId);
  if (page.url) visitedUrls.add(page.url);
  return {
    currentTabId,
    tabs,
    page,
    recentActions: [...recentActions],
    visitedUrls: [...visitedUrls],
  };
}

async function discoverWindowTabs(initialTabId: number, trackedTabs: Set<number>): Promise<void> {
  const initialTab = await browser.tabs.get(initialTabId);
  const tabs = await browser.tabs.query({ windowId: initialTab.windowId });
  for (const tab of tabs) {
    if (tab.id !== undefined && tab.url?.startsWith('http')) trackedTabs.add(tab.id);
  }
}

async function observeWithRetry(tabId: number): Promise<BrowserSnapshot> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      return await new BrowserRuntime(tabId).observe();
    } catch (error) {
      lastError = error;
      await new Promise<void>((resolve) => setTimeout(resolve, 250));
    }
  }
  const tab = await browser.tabs.get(tabId).catch(() => null);
  if (!tab?.url || !isAllowedProtocol(tab.url)) {
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }
  return {
    url: tab.url,
    title: tab.title || '',
    text: '',
    elements: [],
    readiness: {
      documentReadyState: tab.status === 'complete' ? 'complete' : 'loading',
      stable: false,
      stableForMs: 0,
      observedAt: Date.now(),
    },
  };
}

function waitForUser(signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      activeTask &&= { ...activeTask, resume: undefined };
      reject(new DOMException('网页任务已停止', 'AbortError'));
    };
    const resume = () => {
      activeTask &&= { ...activeTask, resume: undefined };
      signal?.removeEventListener('abort', onAbort);
      resolve();
    };
    activeTask = activeTask ? { ...activeTask, resume } : activeTask;
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function isFollowEnabled(): Promise<boolean> {
  const stored = await browser.storage.session.get(BROWSER_TASK_FOLLOW_STORAGE_KEY);
  return stored[BROWSER_TASK_FOLLOW_STORAGE_KEY] === true;
}

async function setTabLocked(tabId: number, locked: boolean): Promise<void> {
  await new BrowserRuntime(tabId).act('set_locked', { locked });
}

async function lockTabWithRetry(tabId: number, signal: AbortSignal): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (signal.aborted) return;
    try {
      await setTabLocked(tabId, true);
      if (signal.aborted) await setTabLocked(tabId, false).catch(() => undefined);
      return;
    } catch {
      if (signal.aborted) return;
      await new Promise<void>((resolve) => setTimeout(resolve, 200));
    }
  }
}

async function createTaskGroup(initialTabId: number, name: string): Promise<number | null> {
  const tabsApi = browser.tabs as typeof browser.tabs & {
    group?: (options: { tabIds: number[] }) => Promise<number>;
  };
  if (typeof tabsApi.group !== 'function') return null;
  // 起始页已在某个 DPP 任务分组时复用该分组，保证一次任务只对应一个分组。
  const existingGroupId = await findTaskGroup(initialTabId);
  if (existingGroupId !== null) return existingGroupId;
  try {
    const groupId = await tabsApi.group({ tabIds: [initialTabId] });
    if (browser.tabGroups?.update) {
      await browser.tabGroups.update(groupId, {
        title: toTaskGroupTitle(name),
        color: 'blue',
        collapsed: false,
      });
    }
    return groupId;
  } catch {
    return null;
  }
}

async function findTaskGroup(tabId: number): Promise<number | null> {
  try {
    const tab = await browser.tabs.get(tabId);
    const groupId = tab.groupId;
    if (groupId === undefined || groupId === -1 || !browser.tabGroups?.get) return null;
    const group = await browser.tabGroups.get(groupId);
    return isTaskGroupTitle(group.title) ? groupId : null;
  } catch {
    return null;
  }
}

async function addToTaskGroup(tabId: number, groupId: number): Promise<void> {
  const tabsApi = browser.tabs as typeof browser.tabs & {
    group?: (options: { tabIds: number[]; groupId: number }) => Promise<number>;
  };
  if (typeof tabsApi.group !== 'function') return;
  try {
    await tabsApi.group({ tabIds: [tabId], groupId });
  } catch {
    // 分组失效不应中断任务动作
  }
}

function parseArguments(call: OpenAIToolCall): Record<string, string> {
  return parseBrowserTaskArguments(call.function.arguments, call.function.name);
}

async function readSummary(): Promise<BrowserTaskSummary | undefined> {
  const stored = await browser.storage.session.get(BROWSER_TASK_STORAGE_KEY);
  return stored[BROWSER_TASK_STORAGE_KEY] as BrowserTaskSummary | undefined;
}
async function updateSummary(update: Partial<BrowserTaskSummary>): Promise<void> {
  const summary = await readSummary();
  if (summary && activeTask?.taskId === summary.taskId && !isTerminalStatus(summary.status))
    await writeSummary({ ...summary, ...update });
}
async function writeSummary(summary: BrowserTaskSummary): Promise<void> {
  const nextSummary = { ...summary, updatedAt: Date.now() };
  await browser.storage.session.set({
    [BROWSER_TASK_STORAGE_KEY]: nextSummary,
  });
  try {
    await browser.runtime.sendMessage({
      type: 'BROWSER_TASK_EVENT',
      taskId: nextSummary.taskId,
      event: nextSummary,
    });
  } catch (error) {
    logger.debug('[BrowserTask] No progress listener available:', error);
  }
}

async function saveCheckpoint(
  taskId: string,
  task: string,
  state: BrowserTaskState,
  ownedTabs: Set<number>
): Promise<void> {
  try {
    const checkpoint: BrowserTaskCheckpoint = {
      taskId,
      task,
      currentTabId: state.currentTabId,
      tabs: state.tabs,
      ownedTabIds: [...ownedTabs],
      recentActions: state.recentActions,
      visitedUrls: state.visitedUrls,
      updatedAt: Date.now(),
    };
    await browser.storage.local.set({ [checkpointKey(taskId)]: checkpoint });
  } catch (error) {
    logger.error('[BrowserTask] 进度检查点写入失败:', error);
  }
}

async function restoreCheckpointTabs(
  checkpoint: BrowserTaskCheckpoint,
  trackedTabs: Set<number>
): Promise<Set<number>> {
  const availableTabs = new Set<number>();
  for (const tab of checkpoint.tabs) {
    try {
      const current = await browser.tabs.get(tab.id);
      if (current.id !== undefined) {
        trackedTabs.add(current.id);
        availableTabs.add(current.id);
      }
    } catch {
      // 关闭的标签页不能安全重建。
    }
  }
  return availableTabs;
}

async function readCheckpoint(taskId: string): Promise<BrowserTaskCheckpoint | undefined> {
  try {
    const stored = await browser.storage.local.get([
      checkpointKey(taskId),
      BROWSER_TASK_CHECKPOINT_STORAGE_KEY,
    ]);
    const checkpoint = stored[checkpointKey(taskId)] as BrowserTaskCheckpoint | undefined;
    if (checkpoint?.taskId === taskId) return checkpoint;
    const legacyCheckpoint = stored[BROWSER_TASK_CHECKPOINT_STORAGE_KEY] as
      | BrowserTaskCheckpoint
      | undefined;
    if (legacyCheckpoint?.taskId === taskId) return legacyCheckpoint;
  } catch (error) {
    logger.error('[BrowserTask] 进度检查点读取失败:', error);
  }
  return undefined;
}

async function clearCheckpoint(taskId: string): Promise<void> {
  try {
    await browser.storage.local.remove([
      checkpointKey(taskId),
      BROWSER_TASK_CHECKPOINT_STORAGE_KEY,
    ]);
  } catch {
    // 清理失败不影响任务结果
  }
}

function checkpointKey(taskId: string): string {
  return `${BROWSER_TASK_CHECKPOINT_STORAGE_KEY}_${taskId}`;
}

function buildResumeMessage(checkpoint: BrowserTaskCheckpoint): string {
  const lines: string[] = [
    `任务：${checkpoint.task}`,
    '',
    '上次执行中断了，以下是执行进度。请先观察当前页面，从断点继续，不要重复已完成的工作。',
    `- 当前标签页：${checkpoint.currentTabId}（若已关闭，以当前活动标签页为准）`,
  ];
  const otherTabs = checkpoint.tabs.filter((tab) => tab.id !== checkpoint.currentTabId);
  if (otherTabs.length > 0) {
    lines.push(
      `- 任务标签页：${otherTabs.map((tab) => `${tab.id}「${tab.title}」${tab.url}`).join('；')}`
    );
  }
  if (checkpoint.visitedUrls.length > 0) {
    lines.push(`- 已访问 URL：${checkpoint.visitedUrls.join('、')}`);
  }
  if (checkpoint.recentActions.length > 0) {
    lines.push('- 最近动作：');
    for (const action of checkpoint.recentActions) {
      const nav = action.navigatedTo ? `（导航到 ${action.navigatedTo}）` : '';
      lines.push(`  ${action.action} → ${action.result}${nav}`);
    }
  }
  return lines.join('\n');
}

function isTerminalStatus(status: BrowserTaskSummary['status']): boolean {
  return status === 'completed' || status === 'failed' || status === 'stopped';
}
