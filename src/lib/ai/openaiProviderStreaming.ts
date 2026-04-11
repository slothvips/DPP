import { logger } from '@/utils/logger';
import { getOpenAIHeaders } from './openaiProviderShared';
import { processOpenAIStreamingEventBlock } from './openaiProviderStreamingEvents';
import {
  buildOpenAIStreamingResponse,
  createOpenAIStreamingState,
} from './openaiProviderStreamingShared';
import { extractSSEEventBlocks } from './providerShared';
import type { ChatResponse, OpenAIChatRequest } from './types';

export async function handleOpenAIStreamingChat(
  url: string,
  apiKey: string,
  requestBody: OpenAIChatRequest,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal
): Promise<ChatResponse> {
  const response = await fetch(url, {
    method: 'POST',
    headers: getOpenAIHeaders(apiKey),
    body: JSON.stringify({ ...requestBody, stream: true }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `OpenAI streaming error: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  if (!response.body) {
    throw new Error('No response body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const state = createOpenAIStreamingState();
  let buffer = '';

  try {
    while (true) {
      if (signal?.aborted) {
        logger.info('[OpenAI] Streaming aborted by user');
        break;
      }

      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const { events, remainder } = extractSSEEventBlocks(buffer);
      buffer = remainder;

      for (const eventBlock of events) {
        processOpenAIStreamingEventBlock({
          eventBlock,
          state,
          onChunk,
        });
      }
    }

    if (buffer.trim()) {
      processOpenAIStreamingEventBlock({
        eventBlock: buffer,
        state,
        onChunk,
      });
    }
  } finally {
    reader.releaseLock();
  }

  return buildOpenAIStreamingResponse(state);
}
