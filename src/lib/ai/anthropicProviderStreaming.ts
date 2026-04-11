import { logger } from '@/utils/logger';
import {
  buildAnthropicOpenAIRequestBody,
  getAnthropicHeaders,
  getOpenAIHeaders,
} from './anthropicProviderShared';
import { processAnthropicStreamingEventBlock } from './anthropicProviderStreamingEvents';
import {
  buildAnthropicStreamingResponse,
  createAnthropicStreamingState,
} from './anthropicProviderStreamingShared';
import { extractSSEEventBlocks } from './providerShared';
import type { AnthropicChatRequest, ChatResponse } from './types';

interface HandleAnthropicStreamingChatOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  requestBody: AnthropicChatRequest;
  onChunk: (chunk: string) => void;
  signal?: AbortSignal;
}

export async function handleAnthropicStreamingChat({
  baseUrl,
  apiKey,
  model,
  requestBody,
  onChunk,
  signal,
}: HandleAnthropicStreamingChatOptions): Promise<ChatResponse> {
  const nativeUrl = `${baseUrl}/v1/messages`;
  logger.debug(`[Anthropic] Trying native streaming endpoint: ${nativeUrl}`);

  let response: Response | null = null;

  try {
    response = await fetch(nativeUrl, {
      method: 'POST',
      headers: getAnthropicHeaders(apiKey),
      body: JSON.stringify({ ...requestBody, stream: true }),
      signal,
    });

    if (!response.ok) {
      if (response.status === 404) {
        response = null;
      } else {
        const errorText = await response.text();
        throw new Error(`Anthropic streaming error: ${response.status} - ${errorText}`);
      }
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('404')) {
      response = null;
    } else {
      throw error;
    }
  }

  if (!response) {
    const openAIUrl = `${baseUrl}/v1/chat/completions`;
    logger.debug(`[Anthropic] Trying OpenAI-compatible streaming endpoint: ${openAIUrl}`);

    response = await fetch(openAIUrl, {
      method: 'POST',
      headers: getOpenAIHeaders(apiKey),
      body: JSON.stringify({
        ...buildAnthropicOpenAIRequestBody(model, requestBody),
        stream: true,
      }),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI-compatible streaming error: ${response.status} - ${errorText}`);
    }
  }

  if (!response.body) {
    throw new Error('No response body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const state = createAnthropicStreamingState();
  let buffer = '';

  try {
    while (true) {
      if (signal?.aborted) {
        logger.info('[Anthropic] Streaming aborted by user');
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
        processAnthropicStreamingEventBlock({
          eventBlock,
          state,
          onChunk,
        });
      }
    }

    if (buffer.trim()) {
      processAnthropicStreamingEventBlock({
        eventBlock: buffer,
        state,
        onChunk,
      });
    }
  } finally {
    reader.releaseLock();
  }

  logger.debug(`[Anthropic] Streaming complete, total content length: ${state.fullContent.length}`);

  return buildAnthropicStreamingResponse(state);
}
