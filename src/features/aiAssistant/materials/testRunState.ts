import type { TestCaseStep, TestRunStatus, TestStepResult } from './testCaseTypes';

export function isTerminalTestRunStatus(status: TestRunStatus): boolean {
  return (
    status === 'passed' ||
    status === 'failed' ||
    status === 'blocked' ||
    status === 'error' ||
    status === 'stopped'
  );
}

export function getTestRunStatusAfterStep(status: TestStepResult['status']): TestRunStatus {
  if (status === 'blocked' || status === 'error') return status;
  return 'running';
}

export function getNextTestStepId(
  steps: readonly TestCaseStep[],
  results: readonly TestStepResult[],
  additionalCompletedStepId?: string
): string | undefined {
  const completedStepIds = new Set(results.map((result) => result.stepId));
  if (additionalCompletedStepId) completedStepIds.add(additionalCompletedStepId);
  return steps.find((step) => !completedStepIds.has(step.id))?.id;
}
