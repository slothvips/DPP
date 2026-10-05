import { redactCapturedText, truncateCapturedText } from '../../utils/captureSanitize.ts';
import { MAX_STREAM_CHUNKS, STREAM_THROTTLE_MS, type StreamChunk } from './types.ts';

export interface StreamAccumulator {
  body: string;
  chunks: StreamChunk[];
  chunkIndex: number;
  lastEmitTime: number;
  receivedBytes: number;
  separator: string;
  truncated: boolean;
}

export function createStreamAccumulator(separator: string = ''): StreamAccumulator {
  return {
    body: '',
    chunks: [],
    chunkIndex: 0,
    lastEmitTime: 0,
    receivedBytes: 0,
    separator,
    truncated: false,
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
  if (state.truncated) {
    return;
  }

  const redacted = truncateCapturedText(redactCapturedText(data).text);
  chunk.data = redacted.text;
  const separator = state.body && state.separator ? state.separator : '';
  const limited = truncateCapturedText(`${state.body}${separator}${redacted.text}`);
  state.body = limited.text;
  state.truncated = redacted.truncated || limited.truncated;
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
