import type {
  TestProjectRun,
  TestProjectRunContent,
} from '@/features/aiAssistant/materials/testCaseTypes';
import { getProjectRunStatus } from '@/features/aiAssistant/materials/testProjectRunState';
import { decryptTestCaseContent, encryptTestCaseContent } from '@/lib/db/testCaseShared';
import { mergeProjectRunItems } from './testProjectRunMergeShared';

export { mergeProjectRunItems } from './testProjectRunMergeShared';

export async function mergeTestProjectRunRecords(
  local: TestProjectRun,
  remote: TestProjectRun
): Promise<TestProjectRun> {
  const [localContent, remoteContent] = await Promise.all([
    decryptTestCaseContent<TestProjectRunContent>(local.encryptedContent),
    decryptTestCaseContent<TestProjectRunContent>(remote.encryptedContent),
  ]);
  const testCases = mergeProjectRunItems(localContent.testCases, remoteContent.testCases);
  const latest = remote.updatedAt >= local.updatedAt ? remote : local;
  const now = Math.max(local.updatedAt, remote.updatedAt);
  const finishedAt = maxDefined(local.finishedAt, remote.finishedAt);
  return {
    ...latest,
    projectId: local.projectId,
    projectVersion: local.projectVersion,
    status: finishedAt === undefined ? 'running' : getProjectRunStatus(testCases),
    startedAt: Math.min(local.startedAt, remote.startedAt),
    finishedAt,
    deletedAt: maxDefined(local.deletedAt, remote.deletedAt),
    updatedAt: now,
    encryptedContent: await encryptTestCaseContent({
      projectTitle: latest === remote ? remoteContent.projectTitle : localContent.projectTitle,
      testCases,
    } satisfies TestProjectRunContent),
  };
}

function maxDefined(left: number | undefined, right: number | undefined): number | undefined {
  if (left === undefined) return right;
  if (right === undefined) return left;
  return Math.max(left, right);
}
