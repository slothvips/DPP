import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createSearchSnippet, searchDppCandidates } from '../src/lib/ai/tools/dppSearchShared.ts';
import { createToolParameter, validateToolArguments } from '../src/lib/ai/toolsShared.ts';
import { redactSensitiveText } from '../src/utils/sensitive.ts';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('tool registry validates required fields, types, enums, and bounds', async () => {
  const parameters = createToolParameter(
    {
      name: { type: 'string', description: 'name' },
      count: { type: 'integer', minimum: 1, maximum: 3, description: 'count' },
      mode: { type: 'string', enum: ['safe', 'fast'], description: 'mode' },
    },
    ['name', 'count', 'mode']
  );

  assert.throws(() => validateToolArguments(parameters, {}), /name is required/);
  assert.throws(
    () => validateToolArguments(parameters, { name: 'x', count: 0, mode: 'safe' }),
    /count must be at least 1/
  );
  assert.throws(
    () => validateToolArguments(parameters, { name: 'x', count: 1, mode: 'unknown' }),
    /mode must be one of/
  );
  assert.doesNotThrow(() =>
    validateToolArguments(parameters, { name: 'x', count: 1, mode: 'safe' })
  );
});

test('strict nested schemas reject unknown fields', () => {
  const parameters = createToolParameter(
    {
      item: {
        type: 'object',
        description: 'item',
        properties: { id: { type: 'string', description: 'id' } },
        required: ['id'],
        additionalProperties: false,
      },
    },
    ['item']
  );

  assert.throws(
    () => validateToolArguments(parameters, { item: { id: '1', extra: true } }),
    /item\.extra is not allowed/
  );
});

test('tool execution keeps calls after a confirmation behind the same gate', () => {
  const utility = source('../src/features/aiAssistant/lib/toolCallUtils.ts');
  const flow = source('../src/features/aiAssistant/hooks/useAIChatToolFlowExecution.ts');
  assert.match(utility, /let confirmationStarted = false/);
  assert.match(utility, /if \(requiresConfirmation \|\| confirmationStarted\)/);
  for (const toolName of [
    'clear_session_context',
    'create_new_session',
    'test_case_import',
    'test_run_execute',
    'test_project_execute',
  ]) {
    assert.match(utility, new RegExp(`ALWAYS_CONFIRM_TOOL_NAMES[\\s\\S]*'${toolName}'`));
  }
  assert.match(flow, /requiresActivePlan: pendingToolCalls\.requiresActivePlan/);
});

test('tool execution stops after the first failed call', () => {
  const executor = source('../src/features/aiAssistant/services/executeToolCalls.ts');
  assert.match(executor, /return \{ toolMessages, pendingBuild: null, sessionChanged: false \};/);
});

test('role tool permissions are enforced during classification and execution', () => {
  const utility = source('../src/features/aiAssistant/lib/toolCallUtils.ts');
  const executor = source('../src/features/aiAssistant/services/executeToolCalls.ts');
  const registry = source('../src/lib/ai/toolRegistry.ts');
  assert.match(utility, /当前角色未启用工具/);
  assert.match(executor, /allowedToolNames/);
  assert.match(executor, /toolRegistry\.execute\([\s\S]*options\?\.allowedToolNames/);
  assert.match(registry, /allowedToolNames/);
});

test('role editor groups tools by their registered category', () => {
  const selector = source('../src/features/aiAssistant/components/AIRoleSelector.tsx');
  const runtime = source('../src/features/aiAssistant/roles/roleRuntime.ts');

  assert.match(selector, /const toolGroups = useMemo/);
  assert.match(selector, /groups\.set\(tool\.group/);
  assert.match(selector, /toolGroups\.map\(\(\[group, groupTools\]\)/);
  assert.match(selector, /groupTools\.map\(\(tool\)/);
  assert.match(runtime, /\['delegate_', 'list_browser_', 'page_'\], label: '浏览器'/);
  assert.match(runtime, /\['links_'\], label: '链接'/);
  assert.match(runtime, /\['tags_'\], label: '标签'/);
  assert.match(runtime, /\['blackboard_'\], label: '黑板'/);
  assert.doesNotMatch(runtime, /label: '链接与标签'/);
  assert.doesNotMatch(runtime, /label: '工作台'/);
  assert.match(runtime, /getToolGroupOrder\(left\.group\) - getToolGroupOrder\(right\.group\)/);
});

test('role editor keeps actions visible while its form scrolls', () => {
  const selector = source('../src/features/aiAssistant/components/AIRoleSelector.tsx');

  assert.match(selector, /DialogContent className="flex[^\"]+flex-col overflow-hidden/);
  assert.match(selector, /className="min-h-0 flex-1 space-y-4 overflow-y-auto p-1"/);
  assert.match(selector, /DialogFooter className="shrink-0 border-t/);
});

test('shared form controls keep focus indicators inside clipped containers', () => {
  const controls = [
    source('../src/components/ui/input.tsx'),
    source('../src/components/ui/textarea.tsx'),
    source('../src/components/ui/select.tsx'),
  ];

  for (const control of controls) {
    assert.match(control, /ring-inset/);
    assert.doesNotMatch(control, /ring-offset-2/);
  }
});

test('generic DPP config tools cannot write sensitive settings', () => {
  const config = source('../src/lib/ai/tools/dppConfig.ts');
  assert.match(config, /if \(definition\.sensitive\)/);
  assert.match(config, /writable: definition\.writable && !definition\.sensitive/);
});

test('shared test case updates require confirmation and plans derive status from steps', () => {
  const testCases = source('../src/lib/ai/tools/testCases.ts');
  const plan = source('../src/lib/ai/plan.ts');
  assert.match(testCases, /name: 'test_case_update'[\s\S]*requiresConfirmation: true/);
  assert.match(testCases, /name: 'test_case_import'[\s\S]*requiresConfirmation: true/);
  assert.match(plan, /validatePlanStepStatuses\(steps\)/);
  assert.match(plan, /status: getPlanStatus\(steps\)/);
});

test('DPP search requires every query term and returns a bounded contextual snippet', () => {
  const matches = searchDppCandidates(
    [
      {
        source: 'links',
        id: '1',
        title: 'Production Jenkins',
        text: 'deployment console',
        updatedAt: 1,
      },
      { source: 'links', id: '2', title: 'Jenkins', text: 'local development', updatedAt: 2 },
    ],
    'jenkins deployment'
  );
  assert.deepEqual(
    matches.map((item) => item.id),
    ['1']
  );
  const snippet = createSearchSnippet(
    `${'before '.repeat(50)}deployment${' after'.repeat(50)}`,
    'deployment',
    80
  );
  assert.ok(snippet.includes('deployment'));
  assert.ok(snippet.length <= 86);
});

test('AI diagnostics redact common credentials from free text', () => {
  assert.equal(
    redactSensitiveText('Authorization: Bearer abc.def'),
    'Authorization: Bearer [redacted]'
  );
  assert.equal(
    redactSensitiveText('password=hello token: xyz'),
    'password=[redacted] token: [redacted]'
  );
});

test('diagnostic and search tools are registered with page reads confirmed', () => {
  const registration = source('../src/lib/ai/toolsRegistration.ts');
  const recorder = source('../src/lib/ai/tools/recorderRegistration.ts');
  const jenkins = source('../src/lib/ai/tools/jenkins.ts');
  const testRuns = source('../src/lib/ai/tools/testRuns.ts');
  const browserTask = source('../src/lib/ai/tools/browserTask.ts');
  const session = source('../src/lib/ai/tools/session.ts');
  assert.match(registration, /registerDppSearchTools\(\)/);
  assert.match(recorder, /name: 'recorder_inspect'/);
  assert.match(jenkins, /name: 'jenkins_get_build_details'/);
  assert.match(testRuns, /name: 'test_run_report'/);
  assert.match(registration, /registerTestProjectTools\(\)/);
  assert.match(browserTask, /name: 'page_read'[\s\S]*requiresConfirmation: true/);
  assert.match(session, /name: 'clear_session_context'/);
  assert.match(registration, /registerSessionTools\(\)/);
});

test('session actions are generic and test execution starts in an isolated session', () => {
  const session = source('../src/lib/ai/tools/session.ts');
  const testRuns = source('../src/lib/ai/tools/testRuns.ts');
  const executor = source('../src/features/aiAssistant/services/executeToolCalls.ts');
  const flow = source('../src/features/aiAssistant/hooks/useAIChatToolFlowExecution.ts');
  const facade = source('../src/features/aiAssistant/hooks/useAIChatFacade.ts');

  assert.match(session, /name: 'create_new_session'/);
  assert.match(session, /role_id[\s\S]*role_title[\s\S]*只能提供一个/);
  assert.doesNotMatch(session, /test_case_id|test_project_id|buildTestCaseExecutionPrompt/);
  assert.match(testRuns, /name: 'test_execution_prepare'/);
  assert.match(testRuns, /initial_user_message: buildTestCaseExecutionPrompt/);
  assert.match(testRuns, /initial_user_message: buildTestProjectExecutionPrompt/);
  assert.match(executor, /isSessionAction\(result\)/);
  assert.match(executor, /onSessionAction\?\.\(sessionAction\)/);
  assert.match(flow, /if \(sessionChanged\)/);
  assert.match(facade, /await stopRuntime\(sessionId\)/);
  assert.match(facade, /await clearSessionMessages\(sessionId\)/);
  assert.match(facade, /clearInMemorySessionMessages\(sessionId\)/);
  assert.match(facade, /pendingInitialMessageRef\.current/);
  assert.match(facade, /void sendMessage\(pending\.content\)/);
});

test('DPP search exposes test projects as a searchable source', () => {
  const shared = source('../src/lib/ai/tools/dppSearchShared.ts');
  const search = source('../src/lib/ai/tools/dppSearch.ts');
  assert.match(shared, /'test_projects'/);
  assert.match(search, /case 'test_projects'/);
  assert.match(search, /listTestProjects\(\)/);
});

test('basic local tools are registered, grouped, and selected for new roles', () => {
  const registration = source('../src/lib/ai/toolsRegistration.ts');
  const runtime = source('../src/features/aiAssistant/roles/roleRuntime.ts');
  const selector = source('../src/features/aiAssistant/components/AIRoleSelector.tsx');

  assert.match(registration, /registerDateTimeTools\(\)/);
  assert.match(registration, /registerCalculatorTools\(\)/);
  assert.match(registration, /registerUnitConversionTools\(\)/);
  assert.match(registration, /registerDeveloperUtilityTools\(\)/);
  for (const name of ['date_time', 'calculate', 'convert_units', 'developer_utility']) {
    assert.match(runtime, new RegExp(`'${name}'`));
  }
  assert.match(selector, /!role/);
  assert.match(selector, /BASIC_AI_TOOL_NAMES\.includes\(name\)/);
});
