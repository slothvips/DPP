import { logger } from '@/utils/logger';
import { tryAnthropicNativeRequest, tryAnthropicOpenAIRequest } from './anthropicProviderRequests';
import { buildAnthropicChatRequest, mapAnthropicResponse } from './anthropicProviderShared';
import { handleAnthropicStreamingChat } from './anthropicProviderStreaming';
import type {
  AnthropicChatResponse,
  ChatMessage,
  ChatOptions,
  ChatResponse,
  OpenAIChatResponse,
} from './types';

interface ExecuteAnthropicChatOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  options?: ChatOptions;
}

export async function executeAnthropicChat({
  baseUrl,
  apiKey,
  model,
  messages,
  options,
}: ExecuteAnthropicChatOptions): Promise<ChatResponse> {
  const { requestBody } = buildAnthropicChatRequest(model, messages, options);

  logger.debug(`[Anthropic] Sending chat request to ${baseUrl}`);

  try {
    if (options?.stream && options.onChunk) {
      return await handleAnthropicStreamingChat({
        baseUrl,
        apiKey,
        model,
        requestBody,
        onChunk: options.onChunk,
        signal: options.signal,
      });
    }

    const nativeUrl = `${baseUrl}/v1/messages`;
    logger.debug(`[Anthropic] Trying native endpoint: ${nativeUrl}`);

    let response: AnthropicChatResponse | OpenAIChatResponse | null =
      await tryAnthropicNativeRequest(nativeUrl, apiKey, requestBody);

    if (!response) {
      const openAIUrl = `${baseUrl}/v1/chat/completions`;
      logger.debug(`[Anthropic] Trying OpenAI-compatible endpoint: ${openAIUrl}`);
      response = await tryAnthropicOpenAIRequest(openAIUrl, apiKey, model, requestBody);
    }

    if (!response) {
      throw new Error('Both native and OpenAI-compatible endpoints failed');
    }

    return mapAnthropicResponse(response);
  } catch (error) {
    logger.error('[Anthropic] Chat request failed:', error);
    throw new Error(
      `Anthropic API error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
