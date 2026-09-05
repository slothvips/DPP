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
  assert.match(flow, /requiresActivePlan: pendingToolCalls\.requiresActivePlan/);
});

test('tool execution stops after the first failed call', () => {
  const executor = source('../src/features/aiAssistant/services/executeToolCalls.ts');
  assert.match(executor, /return \{ toolMessages, pendingBuild: null \};/);
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

test('generic DPP config tools cannot write sensitive settings', () => {
  const config = source('../src/lib/ai/tools/dppConfig.ts');
  assert.match(config, /if \(definition\.sensitive\)/);
  assert.match(config, /writable: definition\.writable && !definition\.sensitive/);
});

test('shared test case updates require confirmation and plans derive status from steps', () => {
  const testCases = source('../src/lib/ai/tools/testCases.ts');
  const plan = source('../src/lib/ai/plan.ts');
  assert.match(testCases, /name: 'test_case_update'[\s\S]*requiresConfirmation: true/);
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
  assert.match(registration, /registerDppSearchTools\(\)/);
  assert.match(recorder, /name: 'recorder_inspect'/);
  assert.match(jenkins, /name: 'jenkins_get_build_details'/);
  assert.match(testRuns, /name: 'test_run_report'/);
  assert.match(browserTask, /name: 'page_read'[\s\S]*requiresConfirmation: true/);
});
