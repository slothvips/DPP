import type Dexie from 'dexie';
import type { EntityTable } from 'dexie';
import type { BlackboardItem } from '@/features/blackboard/types';
import type { Recording } from '@/features/recorder/types';
import type { AIMessage, AISession } from './typesAI';
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
import type { DeferredOp, RemoteActivityLog, SyncMetadata, SyncOperation } from './typesSync';

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
  operations: EntityTable<SyncOperation, 'id'>;
  syncMetadata: EntityTable<SyncMetadata, 'id'>;
  deferred_ops: EntityTable<DeferredOp, 'id'>;
  aiSessions: EntityTable<AISession, 'id'>;
  aiMessages: EntityTable<AIMessage, 'id'>;
  remoteActivityLog: EntityTable<RemoteActivityLog, 'id'>;
};
