/**
 * rrweb 插件导出
 */

export const NETWORK_PLUGIN_NAME = 'rrweb/network@1';

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
