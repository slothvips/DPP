import type {
  TestReport,
  TestRun,
  TestRunContent,
} from '@/features/aiAssistant/materials/testCaseTypes';
import { isTerminalTestRunStatus } from '@/features/aiAssistant/materials/testRunState';
import { decryptTestCaseContent, encryptTestCaseContent } from '@/lib/db/testCaseShared';
import { mergeStepResults } from './testRunMergeShared';

export { mergeStepResults } from './testRunMergeShared';

export async function mergeTestRunRecords(local: TestRun, remote: TestRun): Promise<TestRun> {
  const [localContent, remoteContent] = await Promise.all([
    decryptTestCaseContent<TestRunContent>(local.encryptedContent),
    decryptTestCaseContent<TestRunContent>(remote.encryptedContent),
  ]);
  const remoteIsNewer = remote.updatedAt >= local.updatedAt;
  const latestRun = selectLatestRun(local, remote, remoteIsNewer);
  const latestIsRemote = latestRun === remote;
  const latestReport = latestIsRemote ? remoteContent.report : localContent.report;
  const olderReport = latestIsRemote ? localContent.report : remoteContent.report;
  const olderReportWithoutError = { ...olderReport };
  delete olderReportWithoutError.error;
  const stepResults = mergeStepResults(
    localContent.report.stepResults,
    remoteContent.report.stepResults,
    latestIsRemote
  );
  const mergedStatus = resolveMergedStatus(
    latestRun.status,
    stepResults,
    latestRun === remote
      ? remoteContent.testCaseSnapshot.steps.length
      : localContent.testCaseSnapshot.steps.length
  );
  const report: TestReport = {
    ...olderReportWithoutError,
    ...latestReport,
    summary: latestReport.summary || olderReport.summary,
    stepResults,
    updatedAt: Math.max(localContent.report.updatedAt, remoteContent.report.updatedAt),
  };
  const mergedCurrentStepIds = isTerminalTestRunStatus(mergedStatus)
    ? []
    : [
        ...new Set([
          ...(local.currentStepIds ?? (local.currentStepId ? [local.currentStepId] : [])),
          ...(remote.currentStepIds ?? (remote.currentStepId ? [remote.currentStepId] : [])),
        ]),
      ].filter((stepId) => !stepResults.some((result) => result.stepId === stepId));
  const currentStepId =
    latestRun.currentStepId && mergedCurrentStepIds.includes(latestRun.currentStepId)
      ? latestRun.currentStepId
      : mergedCurrentStepIds[0];
  const baseRun = latestRun;

  return {
    ...baseRun,
    testCaseMaterialId: local.testCaseMaterialId,
    testCaseVersion: local.testCaseVersion,
    startedAt: Math.min(local.startedAt, remote.startedAt),
    status: mergedStatus,
    currentStepId,
    currentStepIds: mergedCurrentStepIds,
    finishedAt: maxDefined(local.finishedAt, remote.finishedAt),
    deletedAt: maxDefined(local.deletedAt, remote.deletedAt),
    updatedAt: Math.max(local.updatedAt, remote.updatedAt),
    encryptedContent: await encryptTestCaseContent({
      testCaseSnapshot: localContent.testCaseSnapshot,
      report,
    } satisfies TestRunContent),
  };
}

function resolveMergedStatus(
  status: TestRun['status'],
  stepResults: TestRunContent['report']['stepResults'],
  stepCount: number
): TestRun['status'] {
  if (status !== 'passed') return status;
  if (stepResults.some((result) => result.status === 'failed')) return 'failed';
  if (stepResults.some((result) => result.status === 'blocked')) return 'blocked';
  if (stepResults.some((result) => result.status === 'error')) return 'error';
  return stepResults.length === stepCount &&
    stepResults.every((result) => result.status === 'passed')
    ? 'passed'
    : 'failed';
}

function selectLatestRun(local: TestRun, remote: TestRun, remoteIsNewer: boolean): TestRun {
  const localIsTerminal = isTerminalTestRunStatus(local.status);
  const remoteIsTerminal = isTerminalTestRunStatus(remote.status);
  if (localIsTerminal !== remoteIsTerminal) {
    return localIsTerminal ? local : remote;
  }
  return remoteIsNewer ? remote : local;
}

function maxDefined(left: number | undefined, right: number | undefined): number | undefined {
  if (left === undefined) return right;
  if (right === undefined) return left;
  return Math.max(left, right);
}
