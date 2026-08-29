import { db } from '@/db';
import type {
  DecryptedTestRun,
  TestReport,
  TestRun,
  TestRunContent,
  TestRunStatus,
  TestStepResult,
} from '@/features/aiAssistant/materials/testCaseTypes';
import {
  getNextTestStepId,
  getTestRunStatusAfterStep,
  isTerminalTestRunStatus,
} from '@/features/aiAssistant/materials/testRunState';
import { getTestCaseMaterial } from './materials';
import { decryptTestCaseContent, encryptTestCaseContent } from './testCaseShared';

const MAX_REPORT_TEXT_LENGTH = 4_000;
const MAX_TEST_RUN_PAGE_SIZE = 50;
const testRunLocks = new Map<string, Promise<void>>();

export interface TestRunStepUpdate {
  result: TestStepResult;
  currentStepId?: string;
}

export async function startTestRun(
  testCaseMaterialId: string,
  sessionId?: string
): Promise<TestRun> {
  const material = await getTestCaseMaterial(testCaseMaterialId);
  if (!material || material.status !== 'ready') {
    throw new Error('测试用例不存在或已归档');
  }

  const now = Date.now();
  const report: TestReport = { summary: '', stepResults: [], updatedAt: now };
  const run: TestRun = {
    id: crypto.randomUUID(),
    testCaseMaterialId,
    testCaseVersion: material.version,
    ...(sessionId ? { sessionId } : {}),
    status: 'queued',
    encryptedContent: await encryptTestCaseContent({
      testCaseSnapshot: material.content.definition,
      report,
    } satisfies TestRunContent),
    startedAt: now,
    updatedAt: now,
  };

  await db.testRuns.add(run);
  return run;
}

export async function getTestRun(id: string): Promise<DecryptedTestRun | undefined> {
  const run = await db.testRuns.get(id);
  if (!run || run.deletedAt) {
    return undefined;
  }
  const content = await decryptTestCaseContent<TestRunContent>(run.encryptedContent);
  return { ...run, content };
}

export async function setTestRunCurrentStep(id: string, currentStepId: string): Promise<TestRun> {
  return withTestRunLock(id, async () => {
    const run = await db.testRuns.get(id);
    if (!run || run.deletedAt) {
      throw new Error('测试执行记录不存在');
    }
    if (isTerminalTestRunStatus(run.status)) {
      throw new Error('测试执行已结束，不能继续更新步骤');
    }

    const content = await decryptTestCaseContent<TestRunContent>(run.encryptedContent);
    const step = content.testCaseSnapshot.steps.find((item) => item.id === currentStepId);
    if (!step) {
      throw new Error(`测试步骤不存在：${currentStepId}`);
    }
    if (content.report.stepResults.some((result) => result.stepId === currentStepId)) {
      throw new Error(`测试步骤已完成：${currentStepId}`);
    }
    const nextStepId = getNextTestStepId(
      content.testCaseSnapshot.steps,
      content.report.stepResults
    );
    if (nextStepId !== currentStepId) {
      throw new Error(`必须按顺序执行下一个步骤：${nextStepId || '(无)'}`);
    }

    const now = Date.now();
    const nextRun: TestRun = {
      ...run,
      status: 'running',
      currentStepId,
      currentStepIds: [currentStepId],
      encryptedContent: await encryptTestCaseContent({
        testCaseSnapshot: content.testCaseSnapshot,
        report: { ...content.report, updatedAt: now },
      } satisfies TestRunContent),
      updatedAt: now,
    };
    await db.testRuns.put(nextRun);
    return nextRun;
  });
}

export async function listTestRuns(testCaseMaterialId: string): Promise<DecryptedTestRun[]> {
  const runs = await listTestRunRecords(testCaseMaterialId);
  return decryptTestRunRecords(runs.reverse());
}

export interface TestRunPage {
  runs: DecryptedTestRun[];
  total: number;
}

export async function listTestRunsPage(
  testCaseMaterialId: string,
  offset: number,
  limit: number
): Promise<TestRunPage> {
  if (!Number.isInteger(offset) || offset < 0) {
    throw new Error('测试执行记录分页偏移量无效');
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_TEST_RUN_PAGE_SIZE) {
    throw new Error(`测试执行记录每页数量必须在 1-${MAX_TEST_RUN_PAGE_SIZE} 之间`);
  }

  const records = (await listTestRunRecords(testCaseMaterialId)).reverse();
  return {
    runs: await decryptTestRunRecords(records.slice(offset, offset + limit)),
    total: records.length,
  };
}

export async function listTestRunRecords(testCaseMaterialId: string): Promise<TestRun[]> {
  return db.testRuns
    .where('testCaseMaterialId')
    .equals(testCaseMaterialId)
    .and((run) => !run.deletedAt)
    .sortBy('startedAt');
}

async function decryptTestRunRecords(records: TestRun[]): Promise<DecryptedTestRun[]> {
  return Promise.all(
    records.map(async (run) => ({
      ...run,
      content: await decryptTestCaseContent<TestRunContent>(run.encryptedContent),
    }))
  );
}

export async function findActiveTestRunForSession(sessionId: string): Promise<TestRun | undefined> {
  return db.testRuns
    .where('sessionId')
    .equals(sessionId)
    .filter((run) => !run.deletedAt && !isTerminalTestRunStatus(run.status))
    .first();
}

export async function updateTestRunStep(id: string, update: TestRunStepUpdate): Promise<TestRun> {
  return withTestRunLock(id, async () => {
    const run = await db.testRuns.get(id);
    if (!run || run.deletedAt) {
      throw new Error('测试执行记录不存在');
    }
    if (isTerminalTestRunStatus(run.status)) {
      throw new Error('测试执行已结束，不能继续更新步骤');
    }
    const content = await decryptTestCaseContent<TestRunContent>(run.encryptedContent);
    const snapshotStep = content.testCaseSnapshot.steps.find(
      (step) => step.id === update.result.stepId
    );
    if (!snapshotStep) {
      throw new Error(`测试步骤不存在：${update.result.stepId}`);
    }
    if (snapshotStep.order !== update.result.order) {
      throw new Error(`测试步骤顺序不匹配：${update.result.stepId}`);
    }
    if (content.report.stepResults.some((result) => result.stepId === update.result.stepId)) {
      throw new Error(`测试步骤结果已存在：${update.result.stepId}`);
    }
    if (run.currentStepId && run.currentStepId !== update.result.stepId) {
      throw new Error(`当前测试步骤不是：${update.result.stepId}`);
    }
    const nextStepId = getNextTestStepId(
      content.testCaseSnapshot.steps,
      content.report.stepResults
    );
    if (nextStepId !== update.result.stepId) {
      throw new Error(`必须按顺序保存下一个步骤：${nextStepId || '(无)'}`);
    }
    const nextStepAfterResultId = getNextTestStepId(
      content.testCaseSnapshot.steps,
      content.report.stepResults,
      update.result.stepId
    );
    if (
      update.result.status !== 'blocked' &&
      update.result.status !== 'error' &&
      update.currentStepId &&
      update.currentStepId !== nextStepAfterResultId
    ) {
      throw new Error(`完成步骤后只能设置紧邻的下一个步骤：${nextStepAfterResultId || '(无)'}`);
    }

    const now = Date.now();
    const result = {
      ...update.result,
      actualResult: limitReportText(
        redactTestData(update.result.actualResult, content.testCaseSnapshot),
        '实际结果'
      ),
      detail: limitReportText(
        redactTestData(update.result.detail, content.testCaseSnapshot),
        '步骤说明'
      ),
      attempts: update.result.attempts?.map((attempt) => ({
        ...attempt,
        detail: limitReportText(
          redactTestData(attempt.detail, content.testCaseSnapshot),
          '尝试说明'
        ),
      })),
      updatedAt: now,
    };
    const report: TestReport = {
      ...content.report,
      stepResults: [...content.report.stepResults, result],
      ...(result.status === 'failed' || result.status === 'blocked' || result.status === 'error'
        ? {
            error: limitReportText(
              redactTestData(result.detail ?? result.actualResult, content.testCaseSnapshot),
              '步骤失败原因'
            ),
          }
        : {}),
      updatedAt: now,
    };
    // 阻塞和技术错误都是终态；即使调用方误传下一步，也不能留下可继续执行的游标。
    const nextStepIdToRun =
      update.result.status === 'blocked' || update.result.status === 'error'
        ? undefined
        : update.currentStepId;
    const nextRun: TestRun = {
      ...run,
      status: getTestRunStatusAfterStep(update.result.status),
      ...(nextStepIdToRun
        ? { currentStepId: nextStepIdToRun }
        : { currentStepId: undefined, currentStepIds: [] }),
      ...(nextStepIdToRun ? { currentStepIds: [nextStepIdToRun] } : {}),
      encryptedContent: await encryptTestCaseContent({
        testCaseSnapshot: content.testCaseSnapshot,
        report,
      } satisfies TestRunContent),
      updatedAt: now,
    };
    await db.testRuns.put(nextRun);
    return nextRun;
  });
}

export async function finishTestRun(
  id: string,
  status: Extract<TestRunStatus, 'passed' | 'failed' | 'blocked' | 'error' | 'stopped'>,
  summary: string,
  error?: string
): Promise<TestRun> {
  return withTestRunLock(id, async () => {
    const run = await db.testRuns.get(id);
    if (!run || run.deletedAt) {
      throw new Error('测试执行记录不存在');
    }
    if (isTerminalTestRunStatus(run.status) && run.finishedAt !== undefined) {
      throw new Error('测试执行已结束，不能重复结束');
    }
    const content = await decryptTestCaseContent<TestRunContent>(run.encryptedContent);
    if (!summary.trim()) {
      throw new Error('测试报告总结不能为空');
    }
    if (status === 'passed') {
      const stepIds = new Set(content.report.stepResults.map((result) => result.stepId));
      const allPassed =
        content.testCaseSnapshot.steps.length === content.report.stepResults.length &&
        content.testCaseSnapshot.steps.every(
          (step) =>
            stepIds.has(step.id) &&
            content.report.stepResults.find((result) => result.stepId === step.id)?.status ===
              'passed'
        );
      if (!allPassed) {
        throw new Error('所有测试步骤通过后才能结束为 passed');
      }
    }
    const now = Date.now();
    const report: TestReport = {
      ...content.report,
      summary: limitReportText(redactTestData(summary, content.testCaseSnapshot), '报告总结') ?? '',
      ...(status === 'passed'
        ? { error: undefined }
        : error?.trim()
          ? { error: limitReportText(redactTestData(error, content.testCaseSnapshot), '失败原因') }
          : {}),
      updatedAt: now,
    };
    const nextRun: TestRun = {
      ...run,
      status,
      currentStepId: undefined,
      currentStepIds: [],
      finishedAt: now,
      encryptedContent: await encryptTestCaseContent({
        testCaseSnapshot: content.testCaseSnapshot,
        report,
      } satisfies TestRunContent),
      updatedAt: now,
    };
    await db.testRuns.put(nextRun);
    return nextRun;
  });
}

async function withTestRunLock<T>(id: string, operation: () => Promise<T>): Promise<T> {
  const previous = testRunLocks.get(id) ?? Promise.resolve();
  let release: () => void = () => undefined;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  testRunLocks.set(id, current);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (testRunLocks.get(id) === current) {
      testRunLocks.delete(id);
    }
  }
}

function limitReportText(value: string | undefined, label: string): string | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim();
  if (normalized.length > MAX_REPORT_TEXT_LENGTH) {
    throw new Error(`${label}最多 ${MAX_REPORT_TEXT_LENGTH} 个字符`);
  }
  return normalized;
}

function redactTestData(
  value: string | undefined,
  definition: TestRunContent['testCaseSnapshot']
): string | undefined {
  if (value === undefined) return undefined;
  return definition.testData
    .filter((item) => item.sensitive && item.value)
    .reduce((result, item) => result.replaceAll(item.value, '[redacted]'), value);
}
