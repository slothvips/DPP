/**
 * rrweb 插件导出
 */

export const NETWORK_PLUGIN_NAME = 'rrweb/network@1';
export const CONSOLE_PLUGIN_NAME = 'rrweb/console@1';

export interface NetworkRequest {
  id: string;
  type: 'fetch' | 'xhr';
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
