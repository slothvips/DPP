export interface LinkItem {
  id: string;
  category: string;
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
  url: string;
  name: string;
  color?: string;
  type?: string;
  fullName?: string;
  lastStatus?: 'SUCCESS' | 'FAILURE' | 'ABORTED' | 'UNSTABLE' | 'Building' | 'Unknown';
  lastBuildUrl?: string;
  lastBuildTime?: number;
  lastBuildUser?: string;
  token?: string;
  params?: Record<string, string>;
  env?: string;
}

export interface JenkinsEnvironment {
  id: string;
  name: string;
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

export interface MyBuildItem {
  id: string;
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

export interface JenkinsJobRecord extends JobItem {
  envId: string;
  lastSeenSyncId?: string;
}

export type JenkinsBuildLifecycle = 'queued' | 'running' | 'paused' | 'completed' | 'unknown';

export interface JenkinsBuildRecord {
  id: string;
  envId: string;
  jobUrl: string;
  jobName?: string;
  number: number;
  result?: string;
  lifecycle: JenkinsBuildLifecycle;
  building: boolean;
  owner?: string;
  timestamp: number;
  duration?: number;
  lastSeenAt: number;
  lastSeenSyncId?: string;
}

export interface JenkinsQueueItemRecord {
  envId: string;
  queueId: string;
  jobUrl: string;
  state: 'queued' | 'blocked' | 'cancelled' | 'executable' | 'expired' | 'unknown';
  why?: string;
  buildId?: string;
  createdAt: number;
  updatedAt: number;
  lastSeenSyncId?: string;
}

export interface JenkinsMetricSnapshot {
  requests: { total: number; failed: number; byCode: Record<string, number> };
  cache: { jobs: number; builds: number };
  queue: { polls: number; cancellations: number };
  logs: { chunks: number; bytes: number };
  updatedAt: number;
}

export type JenkinsCapabilityStatus = 'available' | 'unknown' | 'permission' | 'error';

export interface JenkinsCapabilityCheck {
  status: JenkinsCapabilityStatus;
  checkedAt: number;
  reason?: string;
}

export interface JenkinsCapabilitySnapshot {
  checkedAt: number;
  version?: string;
  user?: { id?: string; fullName?: string };
  read?: JenkinsCapabilityCheck;
  queue?: JenkinsCapabilityCheck;
  crumb?: JenkinsCapabilityCheck;
  testReport?: JenkinsCapabilityCheck;
  artifacts?: JenkinsCapabilityCheck;
  parameters?: JenkinsCapabilityCheck;
  pipelineRest?: JenkinsCapabilityCheck;
  permissions?: {
    read: JenkinsCapabilityCheck;
    discover: JenkinsCapabilityCheck;
    build: JenkinsCapabilityCheck;
    cancel: JenkinsCapabilityCheck;
  };
}

export interface JenkinsQueueState {
  lastPollAt: number;
  state: string;
  expired: boolean;
  timeouts: number;
  reason?: string;
}

export interface JenkinsSyncStateRecord {
  envId: string;
  status: 'idle' | 'syncing' | 'success' | 'partial' | 'offline' | 'error';
  lastAttemptAt?: number;
  lastSuccessAt?: number;
  syncId?: string;
  errorCode?: string;
  errorMessage?: string;
  metrics?: JenkinsMetricSnapshot;
  queueState?: JenkinsQueueState;
  capabilities?: JenkinsCapabilitySnapshot;
}

export interface JenkinsBuildOperationRecord {
  id: string;
  envId: string;
  jobUrl: string;
  type: 'trigger' | 'cancel_queue' | 'stop_build' | 'rerun';
  status: 'pending' | 'accepted' | 'unknown' | 'completed' | 'failed';
  parameterSummary?: Record<string, string>;
  queueId?: string;
  buildId?: string;
  createdAt: number;
  updatedAt: number;
  errorCode?: string;
}

export interface LinkStatItem {
  id: string;
  usageCount: number;
  lastUsedAt: number;
  pinnedAt?: number;
}

export interface NewsItem {
  title: string;
  url: string;
  comment: string;
}

export interface NewsSection {
  source: string;
  icon: string;
  items: NewsItem[];
}

/** 每日热点新闻聚合(热讯缓存数据的实际类型) */
export interface DailyNews {
  date: string;
  sections: NewsSection[];
}

export interface HotNewsCache {
  date: string;
  data: DailyNews;
  updatedAt: number;
}
