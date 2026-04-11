import { httpPost } from '@/lib/http';
import { logger } from '@/utils/logger';
import {
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
}

export async function executeOpenAIChat({
  baseUrl,
  apiKey,
  model,
  messages,
  options,
}: ExecuteOpenAIChatOptions): Promise<ChatResponse> {
  const url = `${baseUrl}/chat/completions`;
  const requestBody = buildOpenAIChatRequest(model, messages, options);

  logger.debug(`[OpenAI] Sending chat request to ${url}`);

  try {
    if (options?.stream && options.onChunk) {
      return await handleOpenAIStreamingChat(
        url,
        apiKey,
        requestBody,
        options.onChunk,
        options.signal
      );
    }

    const response = await httpPost<OpenAIChatResponse>(url, requestBody, {
      timeout: 120000,
      headers: getOpenAIHeaders(apiKey),
    });

    return mapOpenAIResponse(response);
  } catch (error) {
    logger.error('[OpenAI] Chat request failed:', error);
    throw new Error(`OpenAI API error: ${error instanceof Error ? error.message : String(error)}`);
  }
}
