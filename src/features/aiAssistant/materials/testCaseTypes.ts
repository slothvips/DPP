import type { EncryptedData } from '@/lib/crypto/encryption';

export type MaterialType = 'prompt' | 'workflow' | 'testCase';

export interface TestCaseTarget {
  id: string;
  order: number;
  name?: string;
  url: string;
}

export interface TestCaseStep {
  id: string;
  order: number;
  targetId: string;
  action: string;
  expectedResult?: string;
}

export interface TestCaseTestData {
  name: string;
  value: string;
  sensitive: boolean;
}

export interface TestCaseDefinition {
  goal: string;
  targets: TestCaseTarget[];
  preconditions: string[];
  testData: TestCaseTestData[];
  steps: TestCaseStep[];
  overallExpectedResult?: string;
}

export interface TestCaseMaterialContent {
  sourceText: string;
  definition: TestCaseDefinition;
}

export interface TestCaseMaterial {
  id: string;
  type: 'testCase';
  title: string;
  status: 'ready' | 'archived';
  version: number;
  encryptedContent: EncryptedData;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

export type TestRunStatus = 'queued' | 'running' | 'passed' | 'failed' | 'blocked' | 'stopped';

export interface TestStepResult {
  stepId: string;
  order: number;
  status: 'passed' | 'failed' | 'blocked' | 'skipped';
  actualResult?: string;
  detail?: string;
  updatedAt?: number;
}

export interface TestReport {
  summary: string;
  stepResults: TestStepResult[];
  error?: string;
  updatedAt: number;
}

export interface TestRunContent {
  testCaseSnapshot: TestCaseDefinition;
  report: TestReport;
}

export interface TestRun {
  id: string;
  testCaseMaterialId: string;
  testCaseVersion: number;
  sessionId?: string;
  status: TestRunStatus;
  currentStepId?: string;
  currentStepIds?: string[];
  encryptedContent: EncryptedData;
  startedAt: number;
  finishedAt?: number;
  updatedAt: number;
  deletedAt?: number;
}

export interface TestCaseMaterialInput {
  title: string;
  sourceText: string;
  definition: TestCaseDefinition;
}

export interface DecryptedTestCaseMaterial extends TestCaseMaterial {
  content: TestCaseMaterialContent;
}

export interface DecryptedTestRun extends TestRun {
  content: TestRunContent;
}
