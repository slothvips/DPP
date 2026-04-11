import { httpPost } from '@/lib/http';
import { logger } from '@/utils/logger';
import { buildOllamaChatRequest, mapOllamaResponse } from './ollamaShared';
import { handleOllamaStreamingChat } from './ollamaStreaming';
import type { ChatMessage, ChatOptions, ChatResponse, OllamaChatResponse } from './types';

interface ExecuteOllamaChatOptions {
  baseUrl: string;
  model: string;
  messages: ChatMessage[];
  options?: ChatOptions;
}

export async function executeOllamaChat({
  baseUrl,
  model,
  messages,
  options,
}: ExecuteOllamaChatOptions): Promise<ChatResponse> {
  const url = `${baseUrl}/api/chat`;
  const requestBody = buildOllamaChatRequest(model, messages, options);

  logger.debug(`[Ollama] Sending chat request to ${url}`);

  try {
    if (options?.stream && options.onChunk) {
      return await handleOllamaStreamingChat(url, requestBody, options.onChunk, options.signal);
    }

    const response = await httpPost<OllamaChatResponse>(url, requestBody, { timeout: 120000 });
    return mapOllamaResponse(response);
  } catch (error) {
    logger.error('[Ollama] Chat request failed:', error);
    throw new Error(`Ollama API error: ${error instanceof Error ? error.message : String(error)}`);
  }
}
