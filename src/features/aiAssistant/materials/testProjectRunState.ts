import type { TestProjectRunItem, TestRunStatus } from './testCaseTypes';

export function getProjectRunStatus(items: readonly TestProjectRunItem[]): TestRunStatus {
  const active = items.filter((item) => item.status !== 'skipped');
  if (active.length === 0) return 'blocked';
  if (active.some((item) => item.status === 'stopped')) return 'stopped';
  if (active.some((item) => item.status === 'error')) return 'error';
  if (active.some((item) => item.status === 'failed')) return 'failed';
  if (active.some((item) => item.status === 'blocked')) return 'blocked';
  if (active.every((item) => item.status === 'passed')) return 'passed';
  if (active.some((item) => item.status === 'running')) return 'running';
  return 'queued';
}
