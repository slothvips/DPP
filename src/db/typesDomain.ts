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

export type NotifyTargetKind = 'user' | 'group';

/** 缺省表示全部订阅。jobs 缺省表示该服务下的全部 Job，空数组表示一个都不订。 */
export interface NotifySubscriptions {
  jenkins?: {
    enabled: boolean;
    jobs?: string[];
  };
}

/** 固定一行，id 永远是 default。清空 Token 写空字符串，不删行。 */
export interface NotifyConfigRecord {
  id: string;
  botToken: string;
  /** 通道试发正文。空字符串表示用默认试发句。功能模块不读这个字段。 */
  messageTemplate?: string;
  /** Jenkins 构建通知模板。空字符串表示用 Jenkins 自己的默认格式。 */
  jenkinsBuildTemplate?: string;
  updatedAt: number;
  deletedAt?: number;
}

export interface NotifyTargetRecord {
  id: string;
  kind: NotifyTargetKind;
  label: string;
  chatId: string;
  /** 不进索引。缺省时这个对象接收全部服务、全部 Job。 */
  subscriptions?: NotifySubscriptions;
  updatedAt: number;
  deletedAt?: number;
}
