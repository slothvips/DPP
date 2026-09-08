import type { OpenAIToolCall, ProviderMessageMetadata, TokenUsage } from '@/lib/ai/types';
import type { EncryptedData } from '@/lib/crypto/encryption';

export type MaterialType = 'prompt' | 'role' | 'testCase' | 'conversation';

export type MaterialStatus = 'ready' | 'archived';

export interface MaterialRecordBase {
  id: string;
  title: string;
  status: MaterialStatus;
  version: number;
  encryptedContent: EncryptedData;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

export interface PromptVariable {
  key: string;
  label: string;
  description?: string;
  required: boolean;
  defaultValue?: string;
  sensitive?: boolean;
}

export interface PromptMaterialContent {
  body: string;
  summary?: string;
  tags: string[];
  variables: PromptVariable[];
}

export interface PromptMaterial extends MaterialRecordBase {
  type: 'prompt';
}

export type RoleToolPolicy = { mode: 'all' } | { mode: 'allowlist'; toolNames: string[] };

export interface RoleMaterialContent {
  description?: string;
  systemPrompt: string;
  toolPolicy: RoleToolPolicy;
}

export interface RoleMaterial extends MaterialRecordBase {
  type: 'role';
  derivedFrom?: {
    roleId: string;
    version: number;
  };
}

export interface RoleUsageEvent {
  id: string;
  roleId: string;
  sessionId: string;
  usedAt: number;
  updatedAt: number;
}

export interface RoleMaterialInput {
  title: string;
  description?: string;
  systemPrompt: string;
  toolPolicy: RoleToolPolicy;
}

export interface DecryptedRoleMaterial extends RoleMaterial {
  content: RoleMaterialContent;
}

export interface AISessionRoleSnapshot {
  roleId: string;
  title: string;
  version: number;
  description?: string;
  systemPrompt: string;
  allowedToolNames: string[];
}

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

export interface TestCaseMaterial extends MaterialRecordBase {
  type: 'testCase';
}

export interface ConversationMaterialMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  name?: string;
  toolCallId?: string;
  toolCalls?: OpenAIToolCall[];
  providerMetadata?: ProviderMessageMetadata;
  usage?: TokenUsage;
  createdAt: number;
}

export interface ConversationMaterialContent {
  summary?: string;
  messages: ConversationMaterialMessage[];
  role?: AISessionRoleSnapshot;
}

export interface ConversationMaterial extends MaterialRecordBase {
  type: 'conversation';
  immutable: true;
}

export type MaterialRecord =
  | PromptMaterial
  | RoleMaterial
  | TestCaseMaterial
  | ConversationMaterial;

export interface PromptMaterialInput {
  title: string;
  body: string;
  summary?: string;
  tags: string[];
  variables: PromptVariable[];
}

export interface DecryptedPromptMaterial extends PromptMaterial {
  content: PromptMaterialContent;
}

export type TestRunStatus =
  | 'queued'
  | 'running'
  | 'passed'
  | 'failed'
  | 'blocked'
  | 'error'
  | 'stopped';

export type TestStepAttemptTrigger = 'initial' | 'automatic_retry' | 'manual_retry';

export interface TestStepAttempt {
  attempt: number;
  trigger: TestStepAttemptTrigger;
  status: 'passed' | 'failed' | 'blocked' | 'error' | 'stopped';
  failureCode?: string;
  browserTaskId?: string;
  recovery?: 'same_tab' | 'reopened_target';
  detail?: string;
  startedAt: number;
  finishedAt: number;
}

export interface TestStepResult {
  stepId: string;
  order: number;
  status: 'passed' | 'failed' | 'blocked' | 'error' | 'skipped';
  actualResult?: string;
  detail?: string;
  browserTaskId?: string;
  attempts?: TestStepAttempt[];
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
  projectRunId?: string;
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

export interface DecryptedConversationMaterial extends ConversationMaterial {
  content: ConversationMaterialContent;
}

export interface DecryptedTestRun extends TestRun {
  content: TestRunContent;
}

export interface TestProjectCaseReference {
  testCaseMaterialId: string;
  order: number;
  enabled: boolean;
}

export interface TestProjectContent {
  description?: string;
  testCases: TestProjectCaseReference[];
}

export interface TestProject extends MaterialRecordBase {
  baseVersion?: number;
}

export interface DecryptedTestProject extends TestProject {
  content: TestProjectContent;
}

export interface TestProjectRunItem {
  testCaseMaterialId: string;
  testCaseVersion?: number;
  testCaseSnapshot?: TestCaseDefinition;
  title: string;
  order: number;
  testRunId?: string;
  status: TestRunStatus | 'skipped';
  error?: string;
  updatedAt: number;
}

export interface TestProjectRunContent {
  projectTitle: string;
  testCases: TestProjectRunItem[];
}

export interface TestProjectRun {
  id: string;
  projectId: string;
  projectVersion: number;
  sessionId?: string;
  status: TestRunStatus;
  encryptedContent: EncryptedData;
  startedAt: number;
  finishedAt?: number;
  updatedAt: number;
  deletedAt?: number;
}

export interface DecryptedTestProjectRun extends TestProjectRun {
  content: TestProjectRunContent;
}
