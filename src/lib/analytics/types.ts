export type AnalyticsMetaValue = string | number | boolean;

/** 只允许一层、基础类型的附加信息，禁止上传任何用户内容 */
export type AnalyticsMeta = Record<string, AnalyticsMetaValue>;

export interface AnalyticsEvent {
  /** 功能模块，预定义枚举 */
  module: string;
  /** 业务动作，预定义枚举 */
  action: string;
  /** 数值，如停留秒数 */
  value?: number;
  meta?: AnalyticsMeta;
}

export interface QueuedAnalyticsEvent extends AnalyticsEvent {
  ts: number;
}

export interface StoredAnalyticsEvent extends QueuedAnalyticsEvent {
  id: number;
}

export interface AnalyticsBatch {
  v: 1;
  instanceId: string;
  extVersion: string;
  browser: string;
  events: QueuedAnalyticsEvent[];
}

export interface TrackOpts {
  value?: number;
  meta?: AnalyticsMeta;
}
