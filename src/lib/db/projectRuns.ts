import { db } from '@/db';
import type {
  DecryptedTestProjectRun,
  TestProjectRun,
  TestProjectRunContent,
  TestProjectRunItem,
  TestRunStatus,
} from '@/features/aiAssistant/materials/testCaseTypes';
import { getProjectRunStatus } from '@/features/aiAssistant/materials/testProjectRunState';
import { getTestCaseMaterial } from './materials';
import { decryptTestCaseContent, encryptTestCaseContent } from './testCaseShared';
import { getTestProject } from './testProjects';

const projectRunLocks = new Map<string, Promise<void>>();

export async function startTestProjectRun(
  projectId: string,
  sessionId?: string
): Promise<DecryptedTestProjectRun> {
  const project = await getTestProject(projectId);
  if (!project) throw new Error('测试项目不存在或已删除');
  const references = [...project.content.testCases].sort((left, right) => left.order - right.order);
  const materials = await Promise.all(
    references.map((reference) => getTestCaseMaterial(reference.testCaseMaterialId))
  );
  const now = Date.now();
  const testCases: TestProjectRunItem[] = references.map((reference, index) => {
    const material = materials[index];
    return {
      testCaseMaterialId: reference.testCaseMaterialId,
      ...(material ? { testCaseVersion: material.version } : {}),
      ...(material ? { testCaseSnapshot: material.content.definition } : {}),
      title: material?.title ?? '已删除的测试用例',
      order: reference.order,
      status: !reference.enabled ? 'skipped' : material ? 'queued' : 'error',
      ...(!material && reference.enabled ? { error: '测试用例不存在或已删除' } : {}),
      updatedAt: now,
    };
  });
  const content: TestProjectRunContent = { projectTitle: project.title, testCases };
  const run: TestProjectRun = {
    id: crypto.randomUUID(),
    projectId: project.id,
    projectVersion: project.version,
    ...(sessionId ? { sessionId } : {}),
    status: 'queued',
    encryptedContent: await encryptTestCaseContent(content),
    startedAt: now,
    updatedAt: now,
  };
  await db.projectRuns.add(run);
  return { ...run, content };
}

export async function getTestProjectRun(id: string): Promise<DecryptedTestProjectRun | undefined> {
  const run = await db.projectRuns.get(id);
  if (!run || run.deletedAt) return undefined;
  const content = await decryptTestCaseContent<TestProjectRunContent>(run.encryptedContent);
  return { ...run, content };
}

export async function listTestProjectRuns(projectId: string): Promise<DecryptedTestProjectRun[]> {
  const records = await db.projectRuns
    .where('projectId')
    .equals(projectId)
    .and((run) => !run.deletedAt)
    .sortBy('startedAt');
  return await Promise.all(
    records.reverse().map(async (run) => ({
      ...run,
      content: await decryptTestCaseContent<TestProjectRunContent>(run.encryptedContent),
    }))
  );
}

export async function updateTestProjectRunItem(
  id: string,
  testCaseMaterialId: string,
  update: Pick<TestProjectRunItem, 'status'> &
    Partial<Pick<TestProjectRunItem, 'testRunId' | 'error'>>
): Promise<TestProjectRun> {
  return await withProjectRunLock(id, async () => {
    const run = await db.projectRuns.get(id);
    if (!run || run.deletedAt || run.finishedAt !== undefined) {
      throw new Error('测试项目执行不存在或已结束');
    }
    const content = await decryptTestCaseContent<TestProjectRunContent>(run.encryptedContent);
    const index = content.testCases.findIndex(
      (item) => item.testCaseMaterialId === testCaseMaterialId
    );
    if (index < 0) throw new Error('项目执行快照中不存在该测试用例');
    const now = Date.now();
    const testCases = content.testCases.map((item, itemIndex) =>
      itemIndex === index ? { ...item, ...update, updatedAt: now } : item
    );
    const next: TestProjectRun = {
      ...run,
      status: 'running',
      encryptedContent: await encryptTestCaseContent({ ...content, testCases }),
      updatedAt: now,
    };
    await db.projectRuns.put(next);
    return next;
  });
}

export async function finishTestProjectRun(id: string): Promise<TestProjectRun> {
  return await withProjectRunLock(id, async () => {
    const run = await db.projectRuns.get(id);
    if (!run || run.deletedAt) throw new Error('测试项目执行不存在');
    if (run.finishedAt !== undefined) return run;
    const content = await decryptTestCaseContent<TestProjectRunContent>(run.encryptedContent);
    const now = Date.now();
    const next: TestProjectRun = {
      ...run,
      status: getProjectRunStatus(content.testCases),
      finishedAt: now,
      updatedAt: now,
    };
    await db.projectRuns.put(next);
    return next;
  });
}

export async function stopTestProjectRun(id: string, reason: string): Promise<void> {
  await withProjectRunLock(id, async () => {
    const run = await db.projectRuns.get(id);
    if (!run || run.deletedAt || run.finishedAt !== undefined) return;
    const content = await decryptTestCaseContent<TestProjectRunContent>(run.encryptedContent);
    const now = Date.now();
    const testCases = content.testCases.map((item) =>
      item.status === 'queued' || item.status === 'running'
        ? { ...item, status: 'stopped' as const, error: reason, updatedAt: now }
        : item
    );
    await db.projectRuns.put({
      ...run,
      status: 'stopped',
      finishedAt: now,
      updatedAt: now,
      encryptedContent: await encryptTestCaseContent({ ...content, testCases }),
    });
  });
}

export async function findActiveTestProjectRunForSession(
  sessionId: string
): Promise<TestProjectRun | undefined> {
  return await db.projectRuns
    .where('sessionId')
    .equals(sessionId)
    .filter((run) => !run.deletedAt && !isTerminalStatus(run.status))
    .first();
}

function isTerminalStatus(status: TestRunStatus): boolean {
  return status !== 'queued' && status !== 'running';
}

async function withProjectRunLock<T>(id: string, operation: () => Promise<T>): Promise<T> {
  const previous = projectRunLocks.get(id) ?? Promise.resolve();
  let release: () => void = () => undefined;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  projectRunLocks.set(id, current);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (projectRunLocks.get(id) === current) projectRunLocks.delete(id);
  }
}
