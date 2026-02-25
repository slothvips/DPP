/**
 * rrweb 网络请求回放插件
 * 在回放时展示录制的网络请求
 */
import type { eventWithTime } from '@rrweb/types';
import { NETWORK_PLUGIN_NAME, type NetworkPluginEvent, type NetworkRequest } from './index';

export interface NetworkReplayPluginOptions {
  /** 网络事件回调 */
  onNetworkEvent?: (request: NetworkRequest, timestamp: number) => void;
}

export interface ReplayNetworkPlugin {
  handler: (event: eventWithTime, isSync: boolean, context: { replayer: unknown }) => void;
}

interface PluginEventData {
  plugin: string;
  payload: NetworkPluginEvent;
}

/**
 * 检查事件是否为网络插件事件
 */
export function isNetworkPluginEvent(event: eventWithTime): boolean {
  return (
    event.type === 6 &&
    typeof event.data === 'object' &&
    event.data !== null &&
    'plugin' in event.data &&
    (event.data as { plugin: string }).plugin === NETWORK_PLUGIN_NAME
  );
}

/**
 * 获取网络插件事件的 payload
 */
function getNetworkPayload(event: eventWithTime): NetworkPluginEvent | null {
  if (!isNetworkPluginEvent(event)) return null;
  const data = event.data as PluginEventData;
  return data.payload;
}

/**
 * 从录制事件中提取所有网络请求
 * 返回的请求包含 eventTimestamp 字段，表示事件在录制中的时间戳
 */
export function extractNetworkRequests(
  events: eventWithTime[]
): (NetworkRequest & { eventTimestamp: number })[] {
  const requests: (NetworkRequest & { eventTimestamp: number })[] = [];

  for (const event of events) {
    const payload = getNetworkPayload(event);
    if (payload && payload.type === 'network') {
      requests.push({
        ...payload.data,
        eventTimestamp: event.timestamp,
      });
    }
  }

  return requests;
}

/**
 * 获取网络请求回放插件
 */
export function getReplayNetworkPlugin(
  options: NetworkReplayPluginOptions = {}
): ReplayNetworkPlugin {
  const { onNetworkEvent } = options;

  return {
    handler(event, _isSync, _context) {
      const payload = getNetworkPayload(event);
      if (payload && payload.type === 'network' && onNetworkEvent) {
        onNetworkEvent(payload.data, payload.timestamp);
      }
    },
  };
}

/**
 * 格式化请求大小
 */
export function formatSize(bytes: number | undefined): string {
  if (bytes === undefined) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * 格式化请求耗时
 */
export function formatDuration(ms: number | undefined): string {
  if (ms === undefined) return '-';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

/**
 * 获取状态码对应的颜色类名
 */
export function getStatusColor(status: number | undefined): string {
  if (status === undefined) return 'text-muted-foreground';
  if (status >= 200 && status < 300) return 'text-green-600';
  if (status >= 300 && status < 400) return 'text-yellow-600';
  if (status >= 400 && status < 500) return 'text-orange-600';
  if (status >= 500) return 'text-red-600';
  return 'text-muted-foreground';
}

/**
 * 获取请求方法对应的颜色类名
 */
export function getMethodColor(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET':
      return 'text-blue-600';
    case 'POST':
      return 'text-green-600';
    case 'PUT':
      return 'text-orange-600';
    case 'DELETE':
      return 'text-red-600';
    case 'PATCH':
      return 'text-purple-600';
    default:
      return 'text-muted-foreground';
  }
}
