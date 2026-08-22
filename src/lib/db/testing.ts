import { db } from '@/db';
import type { TestCase, TestRun } from '@/features/testing/types';

function validateTestCaseInput(name: string, instruction: string): void {
  if (!name.trim()) {
    throw new Error('测试用例名称不能为空');
  }
  if (!instruction.trim()) {
    throw new Error('测试描述不能为空');
  }
}

export async function listTestCases(): Promise<TestCase[]> {
  return db.testCases.orderBy('updatedAt').reverse().toArray();
}

export async function getTestCase(id: string): Promise<TestCase | undefined> {
  return db.testCases.get(id);
}

export async function saveTestCase(input: {
  id?: string;
  name: string;
  instruction: string;
}): Promise<TestCase> {
  validateTestCaseInput(input.name, input.instruction);
  const now = Date.now();
  const existing = input.id ? await db.testCases.get(input.id) : undefined;
  const testCase: TestCase = {
    id: existing?.id ?? crypto.randomUUID(),
    name: input.name.trim(),
    instruction: input.instruction.trim(),
    enabled: existing?.enabled ?? true,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await db.testCases.put(testCase);
  return testCase;
}

export async function deleteTestCase(id: string): Promise<void> {
  await db.transaction('rw', db.testCases, db.testRuns, async () => {
    const activeRuns = await db.testRuns
      .where('testCaseId')
      .equals(id)
      .filter((run) => run.status === 'queued' || run.status === 'running')
      .count();
    if (activeRuns > 0) {
      throw new Error('测试执行中，完成或停止后才能删除测试用例');
    }
    await db.testCases.delete(id);
    await db.testRuns.where('testCaseId').equals(id).delete();
  });
}

export async function listTestRuns(testCaseId: string): Promise<TestRun[]> {
  return db.testRuns.where('testCaseId').equals(testCaseId).reverse().sortBy('startedAt');
}

export async function createTestRun(input: {
  testCaseId: string;
  aiSessionId: string;
  recordingEnabled: boolean;
}): Promise<TestRun> {
  const run: TestRun = {
    id: crypto.randomUUID(),
    testCaseId: input.testCaseId,
    aiSessionId: input.aiSessionId,
    status: 'queued',
    recordingEnabled: input.recordingEnabled,
    startedAt: Date.now(),
  };
  await db.testRuns.add(run);
  return run;
}

export async function updateTestRun(id: string, changes: Partial<TestRun>): Promise<void> {
  await db.testRuns.update(id, changes);
}
