import { type SseRuntimeState, createSseSnapshot } from './sseShared';
import { appendStreamChunk, shouldEmitStreamUpdate } from './stream';
import { emitNetworkEvent } from './utils';

export function emitSseStartEvent(state: SseRuntimeState) {
  emitNetworkEvent({
    id: state.id,
    type: 'sse',
    method: 'GET',
    url: state.url,
    startTime: state.startTime,
    phase: 'start',
    isStreaming: true,
  });
}

export function emitSseOpenEvent(state: SseRuntimeState) {
  emitNetworkEvent({
    id: state.id,
    type: 'sse',
    method: 'GET',
    url: state.url,
    startTime: state.startTime,
    status: 200,
    statusText: 'OK',
    responseType: 'text/event-stream',
    phase: 'response-headers',
    isStreaming: true,
  });
}

export function emitSseMessageEvent(state: SseRuntimeState, event: MessageEvent) {
  const messageData = typeof event.data === 'string' ? event.data : JSON.stringify(event.data);
  appendStreamChunk(state.stream, messageData, new Blob([messageData]).size);

  if (!shouldEmitStreamUpdate(state.stream)) {
    return;
  }

  emitNetworkEvent({
    id: state.id,
    type: 'sse',
    method: 'GET',
    url: state.url,
    startTime: state.startTime,
    status: 200,
    responseType: 'text/event-stream',
    phase: 'response-body',
    isStreaming: true,
    ...createSseSnapshot(state),
  });
}

export function emitSseErrorEvent(state: SseRuntimeState, isComplete: boolean) {
  const endTime = Date.now();
  emitNetworkEvent({
    id: state.id,
    type: 'sse',
    method: 'GET',
    url: state.url,
    startTime: state.startTime,
    endTime,
    duration: endTime - state.startTime,
    status: isComplete ? 200 : undefined,
    responseType: 'text/event-stream',
    phase: isComplete ? 'complete' : 'error',
    error: isComplete ? undefined : 'SSE connection error',
    isStreaming: true,
    ...createSseSnapshot(state),
  });
}

export function emitSseCloseEvent(state: SseRuntimeState) {
  const endTime = Date.now();
  emitNetworkEvent({
    id: state.id,
    type: 'sse',
    method: 'GET',
    url: state.url,
    startTime: state.startTime,
    endTime,
    duration: endTime - state.startTime,
    status: 200,
    responseType: 'text/event-stream',
    phase: 'complete',
    isStreaming: true,
    ...createSseSnapshot(state),
  });
}
