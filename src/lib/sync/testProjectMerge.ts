import type {
  TestProject,
  TestProjectCaseReference,
  TestProjectContent,
} from '@/features/aiAssistant/materials/testCaseTypes';
import { decryptTestCaseContent, encryptTestCaseContent } from '@/lib/db/testCaseShared';

export async function mergeTestProjectRecords(
  local: TestProject,
  remote: TestProject
): Promise<TestProject> {
  const latest = remote.updatedAt >= local.updatedAt ? remote : local;
  const other = latest === remote ? local : remote;

  if (isBasedOn(latest, other)) return latest;
  if (isBasedOn(other, latest)) return other;
  if (
    local.version !== remote.version &&
    local.baseVersion === undefined &&
    remote.baseVersion === undefined
  ) {
    return latest;
  }

  const [localContent, remoteContent] = await Promise.all([
    decryptTestCaseContent<TestProjectContent>(local.encryptedContent),
    decryptTestCaseContent<TestProjectContent>(remote.encryptedContent),
  ]);
  const latestContent = latest === remote ? remoteContent : localContent;
  const otherContent = latest === remote ? localContent : remoteContent;
  const references = mergeReferences(latestContent.testCases, otherContent.testCases);
  return {
    ...latest,
    version: Math.max(local.version, remote.version),
    baseVersion: undefined,
    encryptedContent: await encryptTestCaseContent({
      description: latestContent.description,
      testCases: references,
    }),
  };
}

function isBasedOn(candidate: TestProject, base: TestProject): boolean {
  return candidate.baseVersion === base.version;
}

function mergeReferences(
  local: TestProjectCaseReference[],
  remote: TestProjectCaseReference[]
): TestProjectCaseReference[] {
  const merged = new Map<string, TestProjectCaseReference>();
  for (const reference of [...local, ...remote]) {
    const existing = merged.get(reference.testCaseMaterialId);
    if (!existing || reference.order < existing.order) {
      merged.set(reference.testCaseMaterialId, reference);
    }
  }

  return [...merged.values()]
    .sort((left, right) => left.order - right.order)
    .map((reference, index) => ({ ...reference, order: index + 1 }));
}
