import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { buildSendMessagePayload } from '../src/features/aiAssistant/hooks/useAIChatQueue.ts';
import { hasAssistantOutput, trimAgentContext } from '../src/lib/ai/agentRuntime.ts';
import { buildPromptBrowserTaskSection } from '../src/lib/ai/promptBrowserTask.ts';
import { buildTestCaseExecutionPrompt } from '../src/lib/ai/promptTestCases.ts';
import { tryReserveBrowserTask } from '../src/lib/browserTask/scheduler.ts';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('PageAgent is the browser execution core', () => {
  const handler = source('../src/entrypoints/background/handlers/browserTask.ts');
  const agent = source('../src/lib/pageAgent/multiPageAgent.ts');
  const controller = source('../src/entrypoints/pageAgentController.content.ts');

  assert.match(handler, /new MultiPageAgent/);
  assert.match(agent, /PageAgentCore/);
  assert.match(agent, /pageController/);
  assert.match(controller, /new PageController/);
  assert.doesNotMatch(handler, /browser_observe|browser_click|BrowserTaskState/);
});

test('PageAgent controls pages through the official PageController methods', () => {
  const controller = source('../src/entrypoints/pageAgentController.content.ts');
  const remote = source('../src/lib/pageAgent/remotePageController.ts');

  for (const method of ['getBrowserState', 'clickElement', 'inputText', 'selectOption', 'scroll']) {
    assert.match(controller, new RegExp(`controller\\.${method}`));
  }
  assert.match(remote, /browser\.tabs\.sendMessage/);
  assert.doesNotMatch(remote, /chrome\.debugger|puppeteer|BROWSER_CONTROL/);
});

test('PageAgent owns observation and action history', () => {
  const handler = source('../src/entrypoints/background/handlers/browserTask.ts');
  assert.match(handler, /onAfterStep/);
  assert.match(handler, /history: result\.history/);
  assert.match(handler, /customFetch/);
});

test('PageAgent task prompt delegates only the child task', () => {
  const prompt = buildPromptBrowserTaskSection();
  assert.match(prompt, /delegate_browser_agent/);
  assert.doesNotMatch(prompt, /browser_observe|browser_click|browser_fill|browser_openUrl/);
  assert.match(prompt, /逐个委派/);
  assert.doesNotMatch(prompt, /并行|同时委派/);
  assert.match(prompt, /停止并向用户报告阻塞原因/);
});

test('test case execution prompt matches the serial run lifecycle', () => {
  const prompt = buildTestCaseExecutionPrompt('登录流程', 'case-1');
  assert.match(prompt, /严格按照步骤 order 串行执行/);
  assert.match(prompt, /initial_url=该目标 URL/);
  assert.match(prompt, /open_new_tab=true/);
  assert.match(prompt, /保存 passed、failed、blocked 或 stopped/);
  assert.match(prompt, /系统会将当前执行记录结束为 stopped/);
  assert.doesNotMatch(prompt, /并行测试/);
});

test('tooling prompt describes the serial call contract', () => {
  const prompt = source('../src/lib/ai/promptTooling.ts');
  assert.match(prompt, /按请求顺序逐个执行/);
  assert.match(prompt, /等待结果返回后再调用下一个工具/);
});

test('main assistant has no direct browser operation tool', () => {
  const registration = source('../src/lib/ai/toolsRegistration.ts');
  assert.doesNotMatch(registration, /registerBrowserTools/);
  assert.equal(existsSync(new URL('../src/lib/ai/tools/browser.ts', import.meta.url)), false);
});

test('browser task persistence has recovery and idempotency metadata', () => {
  const schema = source('../src/db/schema.ts');
  const types = source('../src/db/typesDatabase.ts');
  const persistence = source('../src/lib/db/browserTasks.ts');
  assert.match(schema, /db\.version\(16\)/);
  assert.match(schema, /status, idempotencyKey/);
  assert.match(types, /idempotencyKey\?: string/);
  assert.match(types, /leaseExpiresAt\?: number/);
  assert.match(persistence, /findBrowserTaskByIdempotencyKey/);
});

test('rewinding a session removes child tasks created after the history point', () => {
  const mutations = source('../src/lib/db/aiMutations.ts');
  assert.match(mutations, /createdAt >= truncateAfter\.createdAt/);
  assert.match(mutations, /removedToolCallIds\.has\(summary\.toolCallId\)/);
  assert.match(mutations, /db\.browserTasks\.bulkDelete\(taskIds\)/);
});

test('PageAgent runtime boundaries reject unsafe direct paths', () => {
  const router = source('../src/entrypoints/background/backgroundMessageRouter.ts');
  const content = source('../src/entrypoints/pageAgentController.content.ts');
  const tabs = source('../src/lib/pageAgent/tabsController.ts');
  assert.doesNotMatch(router, /handlePageAgentLlmRequest/);
  assert.match(content, /isPageControlAction/);
  assert.match(content, /sender\.id !== browser\.runtime\.id/);
  assert.match(tabs, /只能打开 HTTP 或 HTTPS 网页/);
});

test('PageAgent waits for a newly created initial tab before validating it', () => {
  const tabs = source('../src/lib/pageAgent/tabsController.ts');
  assert.match(
    tabs,
    /async init\(task: string\): Promise<void> \{\n    await this\.waitUntilTabLoaded\(this\.initialTabId\);/
  );
});

test('parallel page loads use a bounded grace window with diagnostics', () => {
  const tabs = source('../src/lib/pageAgent/tabsController.ts');
  assert.match(tabs, /const TAB_LOAD_TIMEOUT_MS = 30_000/);
  assert.match(tabs, /const deadline = Date\.now\(\) \+ TAB_LOAD_TIMEOUT_MS/);
  assert.match(tabs, /lastUrl = tab\.url/);
});

test('OpenCode PageAgent requests use the compatible tool choice shape', () => {
  const handler = source('../src/entrypoints/background/handlers/browserTask.ts');
  assert.match(handler, /providerType !== 'opencode'/);
  assert.match(handler, /requestBody\.tool_choice = 'required'/);
  assert.match(handler, /delete requestBody\.parallel_tool_calls/);
});

test('browser task lifecycle preserves stop and user takeover', () => {
  const handler = source('../src/entrypoints/background/handlers/browserTask.ts');
  const agent = source('../src/lib/pageAgent/multiPageAgent.ts');
  const remote = source('../src/lib/pageAgent/remotePageController.ts');
  assert.match(handler, /BROWSER_TASK_STOP/);
  assert.match(handler, /BROWSER_TASK_RESUME/);
  assert.match(handler, /waiting_user/);
  assert.match(handler, /agent[\s\S]*?\.stop/);
  assert.match(handler, /普通提交、发送、确认操作以及对下一步不确定都不是接管理由/);
  assert.match(agent, /不得用于普通提交、发送、确认操作/);
  assert.doesNotMatch(remote, /高风险点击|确认订单|publish|purchase|authorize/);
});

test('browser task detail persists PageAgent history without a second browser protocol', () => {
  const handler = source('../src/entrypoints/background/handlers/browserTask.ts');
  const panel = source('../src/features/aiAssistant/components/BrowserTaskProgressPanel.tsx');
  const messagesPanel = source(
    '../src/features/aiAssistant/components/AIAssistantMessagesPanel.tsx'
  );
  assert.match(handler, /saveBrowserTaskSummary/);
  assert.match(handler, /createTaskDetailConversation/);
  assert.match(panel, /detail\.history/);
  assert.match(panel, /reflection && actionName !== 'done'/);
  assert.match(panel, /执行结果/);
  assert.match(panel, /!isExpanded && displayedStatus === 'waiting_user'/);
  assert.match(panel, /aria-label="我已完成接管，继续任务"/);
  assert.doesNotMatch(panel, /模型输出/);
  assert.doesNotMatch(panel, /browser_observe|browser_click|browser_fill/);
  assert.match(messagesPanel, /tasksByMessageId\.get\(message\.id\) \|\| \[\]\)\.map/);
  assert.match(messagesPanel, /unanchoredTasks\.map/);
});

test('legacy browser operation core is removed', () => {
  for (const path of [
    '../src/lib/browserTask/arguments.ts',
    '../src/lib/browserTask/groupTitle.ts',
    '../src/lib/browserTask/modelProtocol.ts',
    '../src/lib/browserTask/prompt.ts',
    '../src/lib/browserTask/stepRecord.ts',
    '../src/lib/browserTask/toolDefinitions.ts',
  ]) {
    assert.equal(existsSync(new URL(path, import.meta.url)), false, path);
  }
});

test('assistant context keeps tool calls paired with results', () => {
  const messages = [
    { role: 'system', content: 'system' },
    { role: 'user', content: 'request' },
    { role: 'assistant', content: '', toolCalls: [{ id: 'old' }] },
    { role: 'tool', content: 'old result', toolCallId: 'old' },
    { role: 'assistant', content: '', toolCalls: [{ id: 'new' }] },
    { role: 'tool', content: 'new result', toolCallId: 'new' },
  ];
  trimAgentContext(messages, 4);
  assert.equal(
    messages.some((message) => message.toolCallId === 'new'),
    true
  );
  assert.equal(
    messages.some((message) => message.toolCallId === 'old'),
    false
  );
});

test('empty assistant content is not treated as output', () => {
  assert.equal(hasAssistantOutput({ content: '' }), false);
  assert.equal(hasAssistantOutput({ content: '', toolCalls: [{ id: 'call-1' }] }), true);
});

test('session compression replaces messages in the current session', () => {
  const summary = source('../src/features/aiAssistant/hooks/useAIChatSessionSummary.ts');
  const mutations = source('../src/lib/db/aiMutations.ts');
  const barrel = source('../src/lib/db/ai.ts');
  const view = source('../src/features/aiAssistant/components/AIAssistantView.tsx');

  assert.match(summary, /replaceSessionMessages/);
  assert.doesNotMatch(summary, /createSession|newSession/);
  assert.match(
    mutations,
    /getAIMessagesTable\(\)\.where\('sessionId'\)\.equals\(sessionId\)\.delete/
  );
  assert.match(mutations, /getAIMessagesTable\(\)\.bulkAdd/);
  assert.match(barrel, /replaceSessionMessages/);
  assert.match(view, /status !== 'idle'/);
  assert.match(view, /status === 'idle'/);
  assert.match(view, /当前会话已更新/);
});

test('AI sessions keep runtime and streamed messages isolated', () => {
  const runtime = source('../src/features/aiAssistant/hooks/useAIChatRuntime.ts');
  const messages = source('../src/features/aiAssistant/hooks/useAIChatMessages.ts');
  const state = source('../src/features/aiAssistant/hooks/useAIChatState.ts');
  const header = source('../src/features/aiAssistant/components/AISessionList.tsx');

  assert.match(runtime, /new Map<string, SessionRuntime>/);
  assert.match(runtime, /const runId = createRunId\(\)/);
  assert.match(runtime, /runtime\.runId !== runId/);
  assert.match(messages, /activeSessionIdRef/);
  assert.doesNotMatch(messages, /assistantIdsRef/);
  assert.match(messages, /const id = generateId\(\)/);
  assert.match(messages, /assistantMessageId/);
  assert.match(state, /getSessionStatus/);
  assert.match(header, /sessionStatuses/);
});

test('one-shot test prompts are cleared when changing chat context', () => {
  const view = source('../src/features/aiAssistant/components/AIAssistantView.tsx');
  assert.match(view, /const handleSelectSession = useCallback/);
  assert.match(view, /const handleCreateSession = useCallback/);
  assert.match(view, /const handleDeleteSession = useCallback/);
  assert.match(view, /const handleViewModeChange = useCallback/);
  assert.match(view, /if \(mode !== 'chat'\) setInputDraft\(null\)/);
  assert.match(view, /onSelectSession=\{handleSelectSession\}/);
  assert.match(view, /onDeleteSession=\{handleDeleteSession\}/);
  assert.match(view, /onCreateSession=\{handleCreateSession\}/);
  assert.match(view, /onViewModeChange=\{handleViewModeChange\}/);
});

test('browser tasks enforce tab, resource and global concurrency boundaries', () => {
  const handler = source('../src/entrypoints/background/handlers/browserTask.ts');
  const tool = source('../src/lib/ai/tools/browserTask.ts');
  const prompt = buildPromptBrowserTaskSection();

  assert.match(handler, /const activeTasks = new Map<number, BrowserTaskExecution>/);
  assert.match(handler, /MAX_ACTIVE_BROWSER_TASKS/);
  assert.match(handler, /tryReserveBrowserTask/);
  assert.match(handler, /resourceKeys/);
  assert.match(handler, /execution\.sessionId === sessionId/);
  assert.match(handler, /execution\.controller\.signal\.aborted/);
  assert.match(handler, /queuedTasks\.get\(message\.initialTabId\)\?\.some/);
  assert.match(tool, /resource_keys/);
  assert.match(prompt, /resource_keys/);
  assert.doesNotMatch(tool, /并行测试/);
});

test('test browser tasks carry target and origin isolation metadata', () => {
  const tool = source('../src/lib/ai/tools/browserTask.ts');
  const types = source('../src/lib/browserTask/types.ts');
  const prompt = source('../src/lib/ai/promptTestCases.ts');

  assert.match(tool, /test_target_id/);
  assert.match(tool, /browser-origin:/);
  assert.match(tool, /test-target:/);
  assert.match(types, /closeInitialTab\?: boolean/);
  assert.match(prompt, /test_target_id/);
  assert.doesNotMatch(tool, /getResources/);
});

test('tool calls are temporarily executed one at a time', () => {
  const executor = source('../src/features/aiAssistant/services/executeToolCalls.ts');
  assert.match(
    executor,
    /for \(const \[index, preparedToolCall\] of preparedToolCalls\.entries\(\)/
  );
  assert.doesNotMatch(executor, /const canParallel/);
});

test('browser task retries check idempotency before opening a target tab without closing it', () => {
  const tool = source('../src/lib/ai/tools/browserTask.ts');
  const handler = source('../src/entrypoints/background/handlers/browserTask.ts');

  assert.match(tool, /const idempotencyKey =/);
  assert.match(tool, /const target = await getTargetTab/);
  assert.ok(
    tool.indexOf('const idempotencyKey =') < tool.indexOf('const target = await getTargetTab')
  );
  assert.doesNotMatch(tool, /closeInitialTab:/);
  assert.match(handler, /if \(message\.closeInitialTab\)/);
  assert.match(handler, /if \(task\.closeInitialTab\)/);
  assert.match(tool, /if \(openNewTab\)/);
});

test('parallel tool results are persisted in deterministic call order', () => {
  const persistence = source('../src/features/aiAssistant/services/aiChatPersistence.ts');

  assert.match(persistence, /const batchCreatedAt = Date\.now\(\)/);
  assert.match(persistence, /for \(const \[index, message\] of toolMessages\.entries\(\)/);
  assert.match(persistence, /createdAt: batchCreatedAt \+ index/);
});

test('browser task reservations are synchronous across tab, resource and global limits', () => {
  const activeTasks = new Map();
  assert.equal(
    tryReserveBrowserTask(activeTasks, 1, { resourceKeys: ['browser-tab:1', 'account:shared'] }, 2),
    true
  );
  assert.equal(
    tryReserveBrowserTask(activeTasks, 1, { resourceKeys: ['browser-tab:1'] }, 2),
    false
  );
  assert.equal(
    tryReserveBrowserTask(activeTasks, 2, { resourceKeys: ['account:shared'] }, 2),
    false
  );
  assert.equal(tryReserveBrowserTask(activeTasks, 2, { resourceKeys: ['browser-tab:2'] }, 2), true);
  assert.equal(
    tryReserveBrowserTask(activeTasks, 3, { resourceKeys: ['browser-tab:3'] }, 2),
    false
  );
});

test('queued user messages are added to model context once and in order', () => {
  const messages = [
    { id: 'u1', role: 'user', content: 'first' },
    { id: 'a1', role: 'assistant', content: 'first answer' },
    { id: 'u2', role: 'user', content: 'second' },
    { id: 'u3', role: 'user', content: 'third' },
  ];
  const toProvider = ({ role, content }) => ({ role, content });
  const secondPayload = buildSendMessagePayload(
    messages,
    messages[2],
    toProvider,
    new Set(['u2', 'u3'])
  );

  assert.deepEqual(
    secondPayload.map(({ content }) => content),
    ['first', 'first answer', 'second']
  );

  const thirdPayload = buildSendMessagePayload(
    [...messages, { id: 'a2', role: 'assistant', content: 'second answer' }],
    messages[3],
    toProvider,
    new Set(['u3'])
  );
  assert.deepEqual(
    thirdPayload.map(({ content }) => content),
    ['first', 'first answer', 'second', 'second answer', 'third']
  );
});

test('queued messages resume only after the session returns to idle', () => {
  const actions = source('../src/features/aiAssistant/hooks/useAIChatActions.ts');
  assert.match(actions, /if \(getSessionStatus\(sessionId\) !== 'idle'\) return/);
  assert.match(actions, /if \(status === 'idle'\) void drainQueuedMessages\(\)/);
});

test('closing the assistant does not trigger a browser unload warning', () => {
  const view = source('../src/features/aiAssistant/components/AIAssistantView.tsx');
  assert.doesNotMatch(view, /beforeunload/);
  assert.doesNotMatch(view, /event\.returnValue/);
});
