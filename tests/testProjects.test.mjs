import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getProjectRunStatus } from '../src/features/aiAssistant/materials/testProjectRunState.ts';
import { mergeProjectRunItems } from '../src/lib/sync/testProjectRunMergeShared.ts';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

function item(status, order = 1, updatedAt = 1) {
  return { testCaseMaterialId: `case-${order}`, title: `Case ${order}`, order, status, updatedAt };
}

test('project status aggregates child results with terminal precedence', () => {
  assert.equal(getProjectRunStatus([item('passed')]), 'passed');
  assert.equal(getProjectRunStatus([item('passed'), item('failed', 2)]), 'failed');
  assert.equal(getProjectRunStatus([item('blocked'), item('passed', 2)]), 'blocked');
  assert.equal(getProjectRunStatus([item('failed'), item('error', 2)]), 'error');
  assert.equal(getProjectRunStatus([item('passed'), item('stopped', 2)]), 'stopped');
  assert.equal(getProjectRunStatus([item('skipped')]), 'blocked');
});

test('project run merge preserves completed children over active stale copies', () => {
  const local = [item('passed', 1, 10), item('queued', 2, 20)];
  const remote = [item('running', 1, 30), item('failed', 2, 15)];
  assert.deepEqual(mergeProjectRunItems(local, remote), [local[0], remote[1]]);
});

test('project run merge keeps stopped children over later terminal copies', () => {
  const stopped = item('stopped', 1, 10);
  const failed = item('failed', 1, 30);
  assert.deepEqual(mergeProjectRunItems([stopped], [failed]), [stopped]);
});

test('project import is atomic, defaults to a new project, and only reuses an explicit id', () => {
  const projects = source('../src/lib/db/testProjects.ts');
  const merge = source('../src/lib/sync/testProjectMerge.ts');
  const tools = source('../src/lib/ai/tools/testCases.ts');
  const prompt = source('../src/lib/ai/promptTestCases.ts');

  assert.match(projects, /db\.transaction\('rw', db\.materials, db\.testProjects/);
  assert.match(projects, /db\.materials\.bulkAdd\(testCases\)/);
  assert.match(projects, /createUniqueProjectTitle/);
  assert.match(projects, /String\(date\.getSeconds\(\)\)\.padStart\(2, '0'\)/);
  assert.match(tools, /existing_project_id/);
  assert.match(tools, /optionalText\(record\.existing_project_id\)/);
  assert.match(prompt, /每次导入默认创建新项目/);
  assert.match(prompt, /不得按项目名称自动复用历史项目/);
  assert.match(projects, /baseVersion: current\.version/);
  assert.match(merge, /mergeReferences\(latestContent\.testCases, otherContent\.testCases\)/);
});

test('project execution continues per case and supports stop and refresh recovery', () => {
  const tools = source('../src/lib/ai/tools/testProjects.ts');
  const runs = source('../src/lib/ai/tools/testRuns.ts');
  const types = source('../src/features/aiAssistant/materials/testCaseTypes.ts');

  assert.match(tools, /for \(const item of projectRun\.content\.testCases\)/);
  assert.match(tools, /status: 'error',[\s\S]*sanitizeError\(error\)/);
  assert.match(tools, /findActiveTestProjectRunForSession\(sessionId\)/);
  assert.match(tools, /findActiveTestRunForSession\(sessionId\)/);
  assert.match(tools, /页面刷新中断了当前测试用例/);
  assert.match(tools, /item\.testCaseSnapshot,[\s\S]*item\.testCaseVersion/);
  assert.match(types, /testCaseSnapshot\?: TestCaseDefinition/);
  assert.match(runs, /stopTestProjectRun\(projectRun\.id, reason\)/);
});

test('project tools are registered and execution requires confirmation', () => {
  const registration = source('../src/lib/ai/toolsRegistration.ts');
  const tools = source('../src/lib/ai/tools/testProjects.ts');
  const confirmation = source('../src/features/aiAssistant/components/toolConfirmationShared.ts');

  assert.match(registration, /registerTestProjectTools\(\)/);
  assert.match(tools, /name: 'test_project_execute'[\s\S]*requiresConfirmation: true/);
  assert.match(tools, /name: 'test_project_report'/);
  assert.match(confirmation, /case 'test_project_execute'/);
});

test('material library renders test projects instead of standalone test cases', () => {
  const library = source('../src/features/aiAssistant/components/AIMaterialLibraryView.tsx');
  const projects = source('../src/features/aiAssistant/components/TestProjectLibraryView.tsx');

  assert.doesNotMatch(library, /testCaseSection|aria-label="测试用例资源"/);
  assert.doesNotMatch(library, /value: 'testCase'/);
  assert.match(library, /value: 'testProject', label: '测试项目'/);
  assert.match(library, /testCases=\{decryptedMaterials\}/);
  assert.doesNotMatch(library, /onExecuteTestCase=/);
  assert.doesNotMatch(projects, /renderTestCase|未归类用例|forceExpanded/);
  assert.match(projects, /projectItems\.map\(\(\{ project \}\)/);
  assert.match(projects, /测试用例集合/);
  assert.match(projects, /onEditTestCase/);
});
