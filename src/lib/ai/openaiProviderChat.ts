import { HttpResponseError, httpPost } from '@/lib/http';
import { logger } from '@/utils/logger';
import {
  buildOpenAIApiUrl,
  buildOpenAIChatRequest,
  getOpenAIHeaders,
  mapOpenAIResponse,
} from './openaiProviderShared';
import { handleOpenAIStreamingChat } from './openaiProviderStreaming';
import type { ChatMessage, ChatOptions, ChatResponse, OpenAIChatResponse } from './types';

interface ExecuteOpenAIChatOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  options?: ChatOptions;
  additionalHeaders?: HeadersInit;
}

export async function executeOpenAIChat({
  baseUrl,
  apiKey,
  model,
  messages,
  options,
  additionalHeaders,
}: ExecuteOpenAIChatOptions): Promise<ChatResponse> {
  const url = buildOpenAIApiUrl(baseUrl, 'chat/completions');
  const requestBody = buildOpenAIChatRequest(model, messages, options);

  logger.debug(`[OpenAI] Sending chat request to ${url}`);

  try {
    if (options?.stream && options.onChunk) {
      return await handleOpenAIStreamingChat(
        url,
        apiKey,
        requestBody,
        options.onChunk,
        options.onReasoningChunk,
        options.signal,
        additionalHeaders
      );
    }

    const response = await httpPost<OpenAIChatResponse>(url, requestBody, {
      timeout: 300000,
      headers: getOpenAIHeaders(apiKey, additionalHeaders),
    });

    return mapOpenAIResponse(response);
  } catch (error) {
    logger.error('[OpenAI] Chat request failed:', error);
    if (error instanceof HttpResponseError) {
      throw error;
    }
    throw new Error(`OpenAI API error: ${error instanceof Error ? error.message : String(error)}`);
  }
}
