import type { TestProjectRunItem } from '@/features/aiAssistant/materials/testCaseTypes';

export function mergeProjectRunItems(
  local: TestProjectRunItem[],
  remote: TestProjectRunItem[]
): TestProjectRunItem[] {
  const items = new Map<string, TestProjectRunItem>();
  for (const item of [...local, ...remote]) {
    const key = `${item.order}:${item.testCaseMaterialId}`;
    const existing = items.get(key);
    if (!existing || shouldReplaceProjectRunItem(existing, item)) items.set(key, item);
  }
  return [...items.values()].sort((left, right) => left.order - right.order);
}

function shouldReplaceProjectRunItem(
  current: TestProjectRunItem,
  candidate: TestProjectRunItem
): boolean {
  const currentTerminal = current.status !== 'queued' && current.status !== 'running';
  const candidateTerminal = candidate.status !== 'queued' && candidate.status !== 'running';
  if (currentTerminal !== candidateTerminal) return candidateTerminal;
  if (currentTerminal) {
    const currentPriority = getTerminalPriority(current.status);
    const candidatePriority = getTerminalPriority(candidate.status);
    if (currentPriority !== candidatePriority) return candidatePriority > currentPriority;
  }
  return candidate.updatedAt >= current.updatedAt;
}

function getTerminalPriority(status: TestProjectRunItem['status']): number {
  return {
    skipped: 0,
    passed: 1,
    failed: 2,
    blocked: 3,
    error: 4,
    stopped: 5,
    queued: -1,
    running: -1,
  }[status];
}
