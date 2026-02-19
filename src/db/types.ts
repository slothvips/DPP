import type Dexie from 'dexie';
import type { EntityTable } from 'dexie';
import type { BlackboardItem } from '@/features/blackboard/types';
import type { Recording } from '@/features/recorder/types';
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

export interface JobTagItem {
  jobUrl: string;
  tagId: string;
  updatedAt: number;
  deletedAt?: number;
}

export type SettingKey =
  | 'theme'
  | 'last_sync_time'
  | 'last_sync_status'
  | 'global_sync_status'
  | 'global_sync_error'
  | 'last_global_sync'
  | 'jenkins_host'
  | 'jenkins_user'
  | 'jenkins_token'
  | 'jenkins_environments'
  | 'jenkins_current_env'
  | 'custom_server_url'
  | 'sync_access_token'
  | 'sync_encryption_key'
  | 'feature_hotnews_enabled'
  | 'feature_links_enabled'
  | 'sync_client_id'
  | 'global_sync_start_time'
  | 'show_others_builds'
  | 'ai_provider_type'
  | 'ai_base_url'
  | 'ai_model'
  | 'ai_api_key'
  | 'ai_ollama_base_url'
  | 'ai_ollama_model'
  | 'ai_ollama_api_key'
  | 'ai_openai_base_url'
  | 'ai_openai_model'
  | 'ai_openai_api_key'
  | 'ai_anthropic_base_url'
  | 'ai_anthropic_model'
  | 'ai_anthropic_api_key'
  | 'ai_custom_base_url'
  | 'ai_custom_model'
  | 'ai_custom_api_key'
  | 'ai_webllm_base_url'
  | 'ai_webllm_model'
  | 'ai_webllm_api_key';

export interface Setting {
  key: SettingKey;
  value: unknown;
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
  role: 'user' | 'assistant' | 'system';
  content: string;
  name?: string;
  createdAt: number;
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
};
