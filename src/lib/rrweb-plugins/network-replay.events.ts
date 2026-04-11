import type { eventWithTime } from '@rrweb/types';
import { NETWORK_PLUGIN_NAME, type NetworkPluginEvent, type NetworkRequest } from './index';

export interface NetworkReplayPluginOptions {
  onNetworkEvent?: (request: NetworkRequest, timestamp: number) => void;
}

export interface ReplayNetworkPlugin {
  handler: (event: eventWithTime, isSync: boolean, context: { replayer: unknown }) => void;
}

interface PluginEventData {
  plugin: string;
  payload: NetworkPluginEvent;
}

export function isNetworkPluginEvent(event: eventWithTime): boolean {
  return (
    event.type === 6 &&
    typeof event.data === 'object' &&
    event.data !== null &&
    'plugin' in event.data &&
    (event.data as { plugin: string }).plugin === NETWORK_PLUGIN_NAME
  );
}

function getNetworkPayload(event: eventWithTime): NetworkPluginEvent | null {
  if (!isNetworkPluginEvent(event)) return null;
  const data = event.data as PluginEventData;
  return data.payload;
}

export function extractNetworkRequests(
  events: eventWithTime[]
): (NetworkRequest & { eventTimestamp: number })[] {
  const requestMap = new Map<string, NetworkRequest & { eventTimestamp: number }>();

  for (const event of events) {
    const payload = getNetworkPayload(event);
    if (payload && payload.type === 'network') {
      const requestData = payload.data;
      const existingRequest = requestMap.get(requestData.id);

      if (existingRequest) {
        mergeRequestData(existingRequest, requestData);
      } else {
        requestMap.set(requestData.id, {
          ...requestData,
          eventTimestamp: event.timestamp,
        });
      }
    }
  }

  return Array.from(requestMap.values());
}

function mergeRequestData(
  existing: NetworkRequest & { eventTimestamp: number },
  incoming: NetworkRequest
): void {
  if (incoming.phase) {
    existing.phase = incoming.phase;
  }

  if (incoming.status !== undefined) {
    existing.status = incoming.status;
    existing.statusText = incoming.statusText;
  }

  if (incoming.responseHeaders) {
    existing.responseHeaders = incoming.responseHeaders;
  }

  if (incoming.responseType) {
    existing.responseType = incoming.responseType;
  }

  if (incoming.responseBody !== undefined) {
    existing.responseBody = incoming.responseBody;
  }

  if (incoming.endTime !== undefined) {
    existing.endTime = incoming.endTime;
    existing.duration = incoming.duration;
  }

  if (incoming.error) {
    existing.error = incoming.error;
  }

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
