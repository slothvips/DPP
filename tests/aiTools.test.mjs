import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createToolParameter, validateToolArguments } from '../src/lib/ai/toolsShared.ts';

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
  assert.match(utility, /let confirmationStarted = false/);
  assert.match(utility, /if \(requiresConfirmation \|\| confirmationStarted\)/);
});

test('tool execution stops after the first failed call', () => {
  const executor = source('../src/features/aiAssistant/services/executeToolCalls.ts');
  assert.match(executor, /return \{ toolMessages, pendingBuild: null \};/);
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
