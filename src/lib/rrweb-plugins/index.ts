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
export type SerializedValue =
  | { type: 'string'; value: string }
  | { type: 'number'; value: number }
  | { type: 'boolean'; value: boolean }
  | { type: 'null' }
  | { type: 'undefined' }
  | { type: 'object'; preview: string }
  | { type: 'array'; length: number; preview: string }
  | { type: 'function'; name: string }
  | { type: 'symbol'; description: string }
  | { type: 'error'; name: string; message: string; stack?: string }
  | { type: 'circular' }
  | { type: 'dom'; tagName: string; id?: string; className?: string };

export interface ConsoleLog {
  id: string;
  level: 'log' | 'info' | 'warn' | 'error' | 'debug' | 'trace';
  args: SerializedValue[];
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
  formatConsoleArgs,
  getLevelColor,
  getLevelIcon,
  getReplayConsolePlugin,
  isConsolePluginEvent,
  type ConsoleReplayPluginOptions,
  type ReplayConsolePlugin,
} from './console-replay';
