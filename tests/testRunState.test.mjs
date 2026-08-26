import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { registerDatabaseSchema } from '../src/db/schema.ts';
import {
  getNextTestStepId,
  getTestRunStatusAfterStep,
  isTerminalTestRunStatus,
} from '../src/features/aiAssistant/materials/testRunState.ts';
import { mergeStepResults } from '../src/lib/sync/testRunMergeShared.ts';

await import('fake-indexeddb/auto');
const { default: Dexie } = await import('dexie');

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('test run follows the minimal queued-running-terminal flow', () => {
  assert.equal(isTerminalTestRunStatus('queued'), false);
  assert.equal(getTestRunStatusAfterStep('passed'), 'running');
  assert.equal(getTestRunStatusAfterStep('failed'), 'running');
  assert.equal(getTestRunStatusAfterStep('blocked'), 'blocked');
  assert.equal(isTerminalTestRunStatus('failed'), true);
  assert.equal(isTerminalTestRunStatus('stopped'), true);
});

test('blocked results remain terminal even when later steps exist', () => {
  const steps = [
    { id: 'a', order: 1, targetId: 'page', action: 'a' },
    { id: 'b', order: 2, targetId: 'page', action: 'b' },
  ];
  const results = [{ stepId: 'a', order: 1, status: 'blocked' }];

  assert.equal(getTestRunStatusAfterStep(results[0].status), 'blocked');
  assert.equal(getNextTestStepId(steps, results), 'b');
});

test('next step calculation rejects skipped steps', () => {
  const steps = [
    { id: 'a', order: 1, targetId: 'page', action: 'a' },
    { id: 'b', order: 2, targetId: 'page', action: 'b' },
    { id: 'c', order: 3, targetId: 'page', action: 'c' },
  ];
  const results = [{ stepId: 'a', order: 1, status: 'passed' }];

  assert.equal(getNextTestStepId(steps, results), 'b');
  assert.notEqual(getNextTestStepId(steps, results, 'c'), 'c');
});

test('parallel test run results merge distinct steps and keep the latest duplicate', () => {
  const local = [{ stepId: 'a', order: 1, status: 'passed' }];
  const remote = [
    { stepId: 'b', order: 2, status: 'failed' },
    { stepId: 'a', order: 1, status: 'failed' },
  ];
  assert.deepEqual(mergeStepResults(local, remote, true), [remote[1], remote[0]]);
  assert.deepEqual(mergeStepResults(local, remote, false), [local[0], remote[0]]);
});

test('step result merge preserves a newer local result over an older remote record', () => {
  const local = [{ stepId: 'a', order: 1, status: 'failed', updatedAt: 20 }];
  const remote = [
    { stepId: 'a', order: 1, status: 'passed', updatedAt: 10 },
    { stepId: 'b', order: 2, status: 'passed', updatedAt: 30 },
  ];
  assert.deepEqual(mergeStepResults(local, remote, true), [local[0], remote[1]]);
});

test('test run cancellation has a persisted stop path', () => {
  const tools = source('../src/lib/ai/tools/testRuns.ts');
  const runtime = source('../src/features/aiAssistant/hooks/useAIChatRuntime.ts');
  const flow = source('../src/features/aiAssistant/hooks/useAIChatToolFlow.ts');

  assert.match(tools, /activeRunIdsBySession/);
  assert.match(tools, /finishTestRun\(runId, 'stopped'/);
  assert.match(runtime, /stopTestRunForSession\(targetSessionId/);
  assert.match(flow, /测试执行流程被取消/);
});

test('test run tool failures stop browser work for the same session', () => {
  const executor = source('../src/features/aiAssistant/services/executeToolCalls.ts');

  assert.match(executor, /stopActiveBrowserTask\(options\.browserTaskSessionId, 'chat'\)/);
  assert.match(executor, /测试执行工具保存失败，已停止后续网页操作/);
  assert.match(executor, /isTestRunMutation\(preparedToolCall\.toolCall\.function\.name\)/);
});

test('parallel test runs preserve tombstones and latest metadata during merge', () => {
  const merge = source('../src/lib/sync/testRunMerge.ts');

  assert.match(merge, /const baseRun = latestRun/);
  assert.match(merge, /startedAt: Math\.min\(local\.startedAt, remote\.startedAt\)/);
  assert.match(merge, /deletedAt: maxDefined\(local\.deletedAt, remote\.deletedAt\)/);
});

test('test run state enforces serial step order', () => {
  const runs = source('../src/lib/db/testRuns.ts');
  const tools = source('../src/lib/ai/tools/testRuns.ts');

  assert.doesNotMatch(runs, /assertParallelStepCanStart/);
  assert.match(runs, /必须按顺序执行下一个步骤/);
  assert.match(runs, /必须按顺序保存下一个步骤/);
  assert.match(runs, /只能设置紧邻的下一个步骤/);
  assert.doesNotMatch(runs, /阻塞后不能继续设置下一个步骤/);
  assert.match(tools, /currentStepId: result\.status === 'blocked' \? undefined : currentStepId/);
});

test('v17 database upgrades to encrypted material and test run tables', async () => {
  const name = `DPPMigrationTest-${crypto.randomUUID()}`;
  const oldDb = new Dexie(name);
  oldDb.version(17).stores({
    settings: 'key',
  });
  await oldDb.open();
  await oldDb.close();

  const db = new Dexie(name);
  registerDatabaseSchema(db);
  await db.open();

  assert.equal(await db.table('settings').get('feature_testing_enabled'), undefined);
  assert.ok(db.tables.some((table) => table.name === 'materials'));
  assert.equal(await db.table('testRuns').count(), 0);

  await db.delete();
});
