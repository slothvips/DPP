export const NETWORK_EVENT_NAME = 'dpp-network-request';
export const NETWORK_RESTORE_EVENT = 'dpp-network-restore';

export const STREAMING_CONTENT_TYPES = [
  'text/event-stream',
  'application/x-ndjson',
  'application/stream+json',
];

export const STREAM_THROTTLE_MS = 100;
export const MAX_STREAM_CHUNKS = 1000;

let requestIdCounter = 0;

export type NetworkRequestPhase =
  | 'start'
  | 'response-headers'
  | 'response-body'
  | 'complete'
  | 'error'
  | 'abort';

export interface StreamChunk {
  index: number;
  data: string;
  size: number;
  timestamp: number;
}

export interface NetworkRequestData {
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
  aborted?: boolean;
  phase?: NetworkRequestPhase;
  isStreaming?: boolean;
  streamChunks?: StreamChunk[];
  receivedBytes?: number;
  totalBytes?: number;
}

export interface NetworkRuntimeWindow extends Window {
  __dppNetworkInterceptorInstalled?: boolean;
}

export function generateRequestId(): string {
  return `net-${Date.now()}-${++requestIdCounter}`;
}
