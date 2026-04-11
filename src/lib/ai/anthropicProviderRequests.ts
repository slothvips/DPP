import { logger } from '@/utils/logger';
import {
  buildAnthropicOpenAIRequestBody,
  getAnthropicHeaders,
  getOpenAIHeaders,
} from './anthropicProviderShared';
import type { AnthropicChatRequest, AnthropicChatResponse, OpenAIChatResponse } from './types';

export async function tryAnthropicNativeRequest(
  url: string,
  apiKey: string,
  requestBody: AnthropicChatRequest
): Promise<AnthropicChatResponse | null> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: getAnthropicHeaders(apiKey),
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      const errorText = await response.text();
      throw new Error(`Anthropic error: ${response.status} - ${errorText}`);
    }

    return (await response.json()) as AnthropicChatResponse;
  } catch (error) {
    if (error instanceof Error && error.message.includes('404')) {
      return null;
    }
    throw error;
  }
}

export async function tryAnthropicOpenAIRequest(
  url: string,
  apiKey: string,
  model: string,
  anthropicRequest: AnthropicChatRequest
): Promise<OpenAIChatResponse | null> {
  const openAIRequest = buildAnthropicOpenAIRequestBody(model, anthropicRequest);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: getOpenAIHeaders(apiKey),
      body: JSON.stringify(openAIRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI-compatible error: ${response.status} - ${errorText}`);
    }

    return (await response.json()) as OpenAIChatResponse;
  } catch (error) {
    logger.error('[Anthropic] OpenAI-compatible request failed:', error);
    return null;
  }
}
