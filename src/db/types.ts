import type Dexie from 'dexie';
import type { EntityTable } from 'dexie';
import type { Recording } from '@/features/recorder/types';
import type { SyncMetadata, SyncOperation } from '@/lib/sync/types';

export interface LinkItem {
  id: string;
  category: string; // Deprecated, keeping for type safety during migration
  name: string;
  url: string;
  note?: string;
  updatedAt: number;
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
  | 'custom_server_url'
  | 'sync_access_token'
  | 'sync_encryption_key'
  | 'feature_hotnews_enabled'
  | 'feature_links_enabled'
  | 'sync_client_id'
  | 'global_sync_start_time';

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
}

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

export type DPPDatabase = Dexie & {
  links: EntityTable<LinkItem, 'id'>;
  linkTags: EntityTable<LinkTagItem, never>;
  linkStats: EntityTable<LinkStatItem, 'id'>;
  jobs: EntityTable<JobItem, 'url'>;
  settings: EntityTable<Setting, 'key'>;
  tags: EntityTable<TagItem, 'id'>;
  jobTags: EntityTable<JobTagItem, never>; // Compound key, not single key access
  myBuilds: EntityTable<MyBuildItem, 'id'>;
  hotNews: EntityTable<HotNewsCache, 'date'>;
  recordings: EntityTable<Recording, 'id'>;
  operations: EntityTable<SyncOperation, 'id'>;
  syncMetadata: EntityTable<SyncMetadata, 'id'>;
};
