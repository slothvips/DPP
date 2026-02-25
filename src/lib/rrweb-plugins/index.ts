/**
 * rrweb 插件导出
 */

export const NETWORK_PLUGIN_NAME = 'rrweb/network@1';
export const CONSOLE_PLUGIN_NAME = 'rrweb/console@1';

/**
 * 网络请求阶段
 * - start: 请求开始发送
 * - response-headers: 收到响应头
 * - response-body: 收到响应体（可能多次，用于流式响应）
 * - complete: 请求完成
 * - error: 请求出错
 * - abort: 请求被中止
 */
export type NetworkRequestPhase =
  | 'start'
  | 'response-headers'
  | 'response-body'
  | 'complete'
  | 'error'
  | 'abort';

/**
 * 流式响应数据块
 */
export interface StreamChunk {
  /** 块索引 */
  index: number;
  /** 块数据 */
  data: string;
  /** 块大小（字节） */
  size: number;
  /** 接收时间戳 */
  timestamp: number;
}

export interface NetworkRequest {
  id: string;
  type: 'fetch' | 'xhr' | 'sse';
  method: string;
  url: string;
  status?: number;
  statusText?: string;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  requestBody?: string;
  responseBody?: string;
  responseType?: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  error?: string;
  /** 请求阶段 */
  phase?: NetworkRequestPhase;
  /** 是否为流式响应 */
  isStreaming?: boolean;
  /** 流式响应数据块 */
  streamChunks?: StreamChunk[];
  /** 已接收字节数 */
  receivedBytes?: number;
  /** 总字节数（如果已知） */
  totalBytes?: number;
}

export interface NetworkPluginEvent {
  type: 'network';
  data: NetworkRequest;
  timestamp: number;
}

// Console 插件类型定义
// 深度克隆的值，保留完整现场信息
export type ClonedValue = unknown;

export interface ConsoleLog {
  id: string;
  level: 'log' | 'info' | 'warn' | 'error' | 'debug' | 'trace';
  args: ClonedValue[];
  timestamp: number;
  stack?: string;
}

export interface ConsolePluginEvent {
  type: 'console';
  data: ConsoleLog;
  timestamp: number;
}

export {
  extractNetworkRequests,
  formatDuration,
  formatSize,
  getMethodColor,
  getReplayNetworkPlugin,
  getRequestPhaseLabel,
  getStatusColor,
  isNetworkPluginEvent,
  type NetworkReplayPluginOptions,
  type ReplayNetworkPlugin,
} from './network-replay';

export {
  extractConsoleLogs,
  formatClonedValue,
  getLevelColor,
  getLevelIcon,
  getReplayConsolePlugin,
  isConsolePluginEvent,
  type ConsoleReplayPluginOptions,
  type ReplayConsolePlugin,
} from './console-replay';
