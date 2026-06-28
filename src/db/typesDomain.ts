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
