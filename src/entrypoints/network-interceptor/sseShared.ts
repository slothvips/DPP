import { type StreamAccumulator, createStreamAccumulator } from './stream';
import type { NetworkRequestData } from './types';

export interface SseRuntimeState {
  id: string;
  startTime: number;
  url: string;
  stream: StreamAccumulator;
}

export function createSseRuntimeState(url: string): SseRuntimeState {
  return {
    id: `sse-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    startTime: Date.now(),
    url,
    stream: createStreamAccumulator('\n'),
  };
}

export function createSseSnapshot(
  state: SseRuntimeState
): Pick<NetworkRequestData, 'streamChunks' | 'receivedBytes' | 'responseBody'> {
  return {
    streamChunks: [...state.stream.chunks],
    receivedBytes: state.stream.receivedBytes,
    responseBody: state.stream.body,
  };
}
