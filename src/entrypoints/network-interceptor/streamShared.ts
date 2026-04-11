import { MAX_STREAM_CHUNKS, STREAM_THROTTLE_MS, type StreamChunk } from './types';

export interface StreamAccumulator {
  body: string;
  chunks: StreamChunk[];
  chunkIndex: number;
  lastEmitTime: number;
  receivedBytes: number;
  separator: string;
}

export function createStreamAccumulator(separator: string = ''): StreamAccumulator {
  return {
    body: '',
    chunks: [],
    chunkIndex: 0,
    lastEmitTime: 0,
    receivedBytes: 0,
    separator,
  };
}

export function appendStreamChunk(state: StreamAccumulator, data: string, size: number) {
  const chunk: StreamChunk = {
    index: state.chunkIndex++,
    data,
    size,
    timestamp: Date.now(),
  };

  state.receivedBytes += size;
  state.body += state.body && state.separator ? `${state.separator}${data}` : data;
  state.chunks.push(chunk);

  if (state.chunks.length > MAX_STREAM_CHUNKS) {
    state.chunks.shift();
  }
}

export function shouldEmitStreamUpdate(
  state: StreamAccumulator,
  now: number = Date.now()
): boolean {
  if (now - state.lastEmitTime < STREAM_THROTTLE_MS) {
    return false;
  }

  state.lastEmitTime = now;
  return true;
}
