import type Dexie from 'dexie';
import type { EntityTable } from 'dexie';
import type { BlackboardItem } from '@/features/blackboard/types';
import type { Recording } from '@/features/recorder/types';
import type { TestCase, TestRun } from '@/features/testing/types';
import type { TotpAccountItem } from '@/features/totp/types';
import type { AIPlan, AIPlanOwnerType } from '@/lib/ai/plan';
import type { BrowserTaskSummary } from '@/lib/browserTask/types';
import type { AIMessage, AIProfile, AISession } from './typesAI';
import type {
  HotNewsCache,
  JobItem,
  JobTagItem,
  LinkItem,
  LinkStatItem,
  LinkTagItem,
  MyBuildItem,
  OthersBuildItem,
  TagItem,
} from './typesDomain';
import type { Setting } from './typesSettings';
import type {
  DeferredOp,
  RemoteActivityLog,
  SyncMetadata,
  SyncOperation,
  SyncRecoveryOp,
} from './typesSync';

export interface TotpLocalOrderRecord {
  key: string;
  orderedIds: string[];
}

export interface BrowserTaskRecord {
  taskId: string;
  sessionId?: string;
  summary: BrowserTaskSummary;
  updatedAt: number;
}

export interface AIPlanRecord {
  id: string;
  ownerType: AIPlanOwnerType;
  ownerId: string;
  plan: AIPlan;
  updatedAt: number;
}

export type DPPDatabase = Dexie & {
  links: EntityTable<LinkItem, 'id'>;
  linkTags: EntityTable<LinkTagItem, never>;
  linkStats: EntityTable<LinkStatItem, 'id'>;
  jobs: EntityTable<JobItem, 'url'>;
  settings: EntityTable<Setting, 'key'>;
  tags: EntityTable<TagItem, 'id'>;
  jobTags: EntityTable<JobTagItem, never>;
  myBuilds: EntityTable<MyBuildItem, 'id'>;
  othersBuilds: EntityTable<OthersBuildItem, 'id'>;
  blackboard: EntityTable<BlackboardItem, 'id'>;
  hotNews: EntityTable<HotNewsCache, 'date'>;
  recordings: EntityTable<Recording, 'id'>;
  testCases: EntityTable<TestCase, 'id'>;
  testRuns: EntityTable<TestRun, 'id'>;
  totpAccounts: EntityTable<TotpAccountItem, 'id'>;
  totpLocalOrder: EntityTable<TotpLocalOrderRecord, 'key'>;
  operations: EntityTable<SyncOperation, 'id'>;
  syncMetadata: EntityTable<SyncMetadata, 'id'>;
  deferred_ops: EntityTable<DeferredOp, 'id'>;
  syncRecoveryOps: EntityTable<SyncRecoveryOp, 'id'>;
  aiSessions: EntityTable<AISession, 'id'>;
  aiMessages: EntityTable<AIMessage, 'id'>;
  aiProfiles: EntityTable<AIProfile, 'id'>;
  remoteActivityLog: EntityTable<RemoteActivityLog, 'id'>;
  browserTasks: EntityTable<BrowserTaskRecord, 'taskId'>;
  aiPlans: EntityTable<AIPlanRecord, 'id'>;
};
