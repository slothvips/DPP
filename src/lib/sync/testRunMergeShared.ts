import type { TestStepResult } from '@/features/aiAssistant/materials/testCaseTypes';

export function mergeStepResults(
  local: TestStepResult[],
  remote: TestStepResult[],
  remoteIsNewer: boolean
): TestStepResult[] {
  const merged = new Map(local.map((result) => [result.stepId, result]));
  for (const result of remote) {
    const existing = merged.get(result.stepId);
    const remoteUpdatedAt = result.updatedAt ?? 0;
    const localUpdatedAt = existing?.updatedAt ?? 0;
    if (
      !existing ||
      remoteUpdatedAt > localUpdatedAt ||
      (remoteUpdatedAt === localUpdatedAt && remoteIsNewer)
    ) {
      merged.set(result.stepId, result);
    }
  }
  return [...merged.values()].sort((left, right) => left.order - right.order);
}
