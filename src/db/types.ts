import type Dexie from 'dexie';
import type { EntityTable } from 'dexie';
import type { BlackboardItem } from '@/features/blackboard/types';
import type { Recording } from '@/features/recorder/types';
import type { AIProviderType } from '@/lib/ai/types';
import type { SyncMetadata, SyncOperation } from '@/lib/sync/types';

export interface DeferredOp {
  id?: number;
  table: string;
  op: SyncOperation;
  timestamp: number;
}

export interface LinkItem {
  id: string;
  category: string; // Deprecated, keeping for type safety during migration
  name: string;
  url: string;
  note?: string;
  updatedAt: number;
  createdAt: number;
  deletedAt?: number;
}

export interface LinkTagItem {
  linkId: string;
  tagId: string;
  updatedAt: number;
  deletedAt?: number;
}

export interface JobItem {
  url: string; // primary key
  name: string;
  color?: string; // blue, red, anime...
  type?: string; // Folder, WorkflowJob...
  fullName?: string; // path/to/job
  lastStatus?: 'SUCCESS' | 'FAILURE' | 'ABORTED' | 'UNSTABLE' | 'Building' | 'Unknown';
  lastBuildUrl?: string;
  lastBuildTime?: number;
  lastBuildUser?: string;
  token?: string;
  params?: Record<string, string>;
  env?: string;
}

export interface JenkinsEnvironment {
  id: string; // UUID or unique slug
  name: string; // e.g., "Dev", "UAT", "Production"
  host: string;
  user: string;
  token: string;
  order: number;
}

export interface TagItem {
  id: string;
  name: string;
  color: string;
  updatedAt: number;
  deletedAt?: number;
}

export interface TagWithCounts {
  id: string;
  name: string;
  color: string;
  linkCount: number;
  jobCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface JobTagItem {
  jobUrl: string;
  tagId: string;
  updatedAt: number;
  deletedAt?: number;
}

export interface StoredEncryptedValue {
  ciphertext: string;
  iv: string;
}

export interface MyBuildItem {
  id: string; // url of the build
  number: number;
  jobName: string;
  jobUrl: string;
  result?: string;
  timestamp: number;
  duration?: number;
  building: boolean;
  userName?: string;
  env?: string;
}

export type OthersBuildItem = MyBuildItem;

export interface LinkStatItem {
  id: string; // matches LinkItem.id
  usageCount: number;
  lastUsedAt: number;
  pinnedAt?: number;
}

export interface HotNewsCache {
  date: string;
  data: unknown;
  updatedAt: number;
}

export interface AISession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface AIMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  name?: string;
  createdAt: number;
}

export interface RemoteActivityLog {
  id: string;
  clientId: string;
  table: string;
  type: 'create' | 'update' | 'delete';
  timestamp: number;
  payload?: unknown;
  receivedAt: number;
}

export interface SettingMap {
  theme: 'light' | 'dark' | 'system';
  last_sync_time: number;
  last_sync_status: string;
  global_sync_status: 'idle' | 'syncing' | 'partial' | 'error';
  global_sync_error: string;
  last_global_sync: number;
  jenkins_host: string;
  jenkins_user: string;
  jenkins_token: string;
  jenkins_environments: JenkinsEnvironment[];
  jenkins_current_env: string;
  custom_server_url: string;
  sync_access_token: string;
  sync_encryption_key: string;
  feature_hotnews_enabled: boolean;
  feature_links_enabled: boolean;
  feature_blackboard_enabled: boolean;
  feature_jenkins_enabled: boolean;
  feature_recorder_enabled: boolean;
  feature_ai_assistant_enabled: boolean;
  feature_playground_enabled: boolean;
  sync_client_id: string;
  global_sync_start_time: number;
  show_others_builds: boolean;
  auto_sync_enabled: boolean;
  auto_sync_interval: number;
  ai_provider_type: AIProviderType;
  ai_base_url: string;
  ai_model: string;
  ai_api_key: string | StoredEncryptedValue;
  ai_ollama_base_url: string;
  ai_ollama_model: string;
  ai_ollama_api_key: string | StoredEncryptedValue;
  ai_anthropic_base_url: string;
  ai_anthropic_model: string;
  ai_anthropic_api_key: string | StoredEncryptedValue;
  ai_custom_base_url: string;
  ai_custom_model: string;
  ai_custom_api_key: string | StoredEncryptedValue;
  links_sort_by: 'createdAt' | 'updatedAt' | 'usageCount' | 'lastUsedAt';
}

export type SettingKey = keyof SettingMap;

export type SettingValue<K extends SettingKey> = SettingMap[K];

export interface Setting<K extends SettingKey = SettingKey> {
  key: K;
  value: SettingValue<K>;
}

export type DPPDatabase = Dexie & {
  links: EntityTable<LinkItem, 'id'>;
  linkTags: EntityTable<LinkTagItem, never>;
  linkStats: EntityTable<LinkStatItem, 'id'>;
  jobs: EntityTable<JobItem, 'url'>;
  settings: EntityTable<Setting, 'key'>;
  tags: EntityTable<TagItem, 'id'>;
  jobTags: EntityTable<JobTagItem, never>; // Compound key, not single key access
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
