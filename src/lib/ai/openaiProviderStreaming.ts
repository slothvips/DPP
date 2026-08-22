import { HttpResponseError, extractHttpErrorMessage } from '@/lib/http';
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
  onReasoningChunk?: (chunk: string) => void,
  signal?: AbortSignal,
  additionalHeaders?: HeadersInit
): Promise<ChatResponse> {
  let response = await fetch(url, {
    method: 'POST',
    headers: getOpenAIHeaders(apiKey, additionalHeaders),
    body: JSON.stringify({ ...requestBody, stream: true }),
    signal,
  });

  if (!response.ok && (response.status === 400 || response.status === 422)) {
    const fallbackRequestBody = { ...requestBody };
    delete fallbackRequestBody.stream_options;
    delete fallbackRequestBody.enable_thinking;
    delete fallbackRequestBody.thinking;
    delete fallbackRequestBody.reasoning_effort;
    delete fallbackRequestBody.verbosity;
    logger.warn(
      '[OpenAI] Provider rejected optional request fields; retrying without stream and reasoning options'
    );
    response = await fetch(url, {
      method: 'POST',
      headers: getOpenAIHeaders(apiKey, additionalHeaders),
      body: JSON.stringify({ ...fallbackRequestBody, stream: true }),
      signal,
    });
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new HttpResponseError(response, extractHttpErrorMessage(errorText));
  }

  if (!response.body) {
    throw new Error('No response body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const state = createOpenAIStreamingState(requestBody.model);
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
          onReasoningChunk,
        });
      }
    }

    if (buffer.trim()) {
      processOpenAIStreamingEventBlock({
        eventBlock: buffer,
        state,
        onChunk,
        onReasoningChunk,
      });
    }
  } finally {
    reader.releaseLock();
  }

  return buildOpenAIStreamingResponse(state);
}
