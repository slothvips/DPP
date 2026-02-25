/**
 * rrweb 网络请求回放插件
 * 在回放时展示录制的网络请求
 */
import type { eventWithTime } from '@rrweb/types';
import {
  NETWORK_PLUGIN_NAME,
  type NetworkPluginEvent,
  type NetworkRequest,
  type NetworkRequestPhase,
} from './index';

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
 * 支持流式请求的合并：同一个请求 ID 的多个事件会被合并为一个请求
 * 返回的请求包含 eventTimestamp 字段，表示事件在录制中的时间戳
 */
export function extractNetworkRequests(
  events: eventWithTime[]
): (NetworkRequest & { eventTimestamp: number })[] {
  // 使用 Map 来合并同一请求的多个阶段事件
  const requestMap = new Map<string, NetworkRequest & { eventTimestamp: number }>();

  for (const event of events) {
    const payload = getNetworkPayload(event);
    if (payload && payload.type === 'network') {
      const requestData = payload.data;
      const existingRequest = requestMap.get(requestData.id);

      if (existingRequest) {
        // 合并请求数据，后续阶段的数据覆盖之前的
        mergeRequestData(existingRequest, requestData);
      } else {
        // 新请求
        requestMap.set(requestData.id, {
          ...requestData,
          eventTimestamp: event.timestamp,
        });
      }
    }
  }

  return Array.from(requestMap.values());
}

/**
 * 合并请求数据
 * 用于将同一请求的多个阶段事件合并为一个完整的请求
 */
function mergeRequestData(
  existing: NetworkRequest & { eventTimestamp: number },
  incoming: NetworkRequest
): void {
  // 更新阶段
  if (incoming.phase) {
    existing.phase = incoming.phase;
  }

  // 更新状态码和状态文本
  if (incoming.status !== undefined) {
    existing.status = incoming.status;
    existing.statusText = incoming.statusText;
  }

  // 更新响应头
  if (incoming.responseHeaders) {
    existing.responseHeaders = incoming.responseHeaders;
  }

  // 更新响应类型
  if (incoming.responseType) {
    existing.responseType = incoming.responseType;
  }

  // 更新响应体（取最新的完整响应体）
  if (incoming.responseBody !== undefined) {
    existing.responseBody = incoming.responseBody;
  }

  // 更新时间信息
  if (incoming.endTime !== undefined) {
    existing.endTime = incoming.endTime;
    existing.duration = incoming.duration;
  }

  // 更新错误信息
  if (incoming.error) {
    existing.error = incoming.error;
  }

  // 更新流式相关字段
  if (incoming.isStreaming !== undefined) {
    existing.isStreaming = incoming.isStreaming;
  }

  if (incoming.streamChunks) {
    existing.streamChunks = incoming.streamChunks;
  }

  if (incoming.receivedBytes !== undefined) {
    existing.receivedBytes = incoming.receivedBytes;
  }

  if (incoming.totalBytes !== undefined) {
    existing.totalBytes = incoming.totalBytes;
  }
}

/**
 * 获取请求的当前状态描述
 */
export function getRequestPhaseLabel(phase: NetworkRequestPhase | undefined): string {
  switch (phase) {
    case 'start':
      return '发送中';
    case 'response-headers':
      return '接收头部';
    case 'response-body':
      return '接收数据';
    case 'complete':
      return '完成';
    case 'error':
      return '错误';
    case 'abort':
      return '已中止';
    default:
      return '未知';
  }
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
