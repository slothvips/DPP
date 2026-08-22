export type TestRunStatus = 'queued' | 'running' | 'passed' | 'failed' | 'stopped';

export interface TestCase {
  id: string;
  name: string;
  instruction: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface TestReportStep {
  index: number;
  description: string;
  expected?: string;
  actual?: string;
  status: 'passed' | 'failed' | 'blocked';
  detail?: string;
}

export interface TestReport {
  passed: boolean;
  summary: string;
  steps: TestReportStep[];
  rawResult?: string;
  error?: string;
}

export interface TestRun {
  id: string;
  testCaseId: string;
  aiSessionId: string;
  status: TestRunStatus;
  recordingEnabled: boolean;
  recordingId?: string;
  startedAt: number;
  finishedAt?: number;
  report?: TestReport;
}
