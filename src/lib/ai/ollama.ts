// Ollama model provider implementation
import { http, httpPost } from '@/lib/http';
import { logger } from '@/utils/logger';
import type {
  ChatMessage,
  ChatOptions,
  ChatResponse,
  Model,
  ModelProvider,
  OllamaChatRequest,
  OllamaChatResponse,
  OllamaMessage,
} from './types';

/**
 * Default Ollama configuration
 */
export const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434';
export const DEFAULT_OLLAMA_MODEL = 'llama3.2';

export function stripThinkingContent(content: string): string {
  return content
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>[\s\S]*$/gi, '')
    .trim();
}

/**
 * Ollama provider implementation
 */
export class OllamaProvider implements ModelProvider {
  name = 'ollama';
  baseUrl: string;
  private _model: string;

  constructor(baseUrl: string = DEFAULT_OLLAMA_BASE_URL, model: string = DEFAULT_OLLAMA_MODEL) {
    this.baseUrl = baseUrl;
    this._model = model;
  }

  getModelName(): string {
    return this._model;
  }

  setModel(model: string): void {
    this._model = model;
  }

  /**
   * Convert internal ChatMessage to Ollama message format
   */
  private toOllamaMessage(message: ChatMessage): OllamaMessage {
    return {
      role: message.role,
      content: message.content,
      name: message.name,
      tool_call_id: message.toolCallId,
      tool_calls: message.toolCalls,
    };
  }

  /**
   * Send a chat request to Ollama
   */
  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    const url = `${this.baseUrl}/api/chat`;

    const ollamaMessages: OllamaMessage[] = messages.map((m) => this.toOllamaMessage(m));

    const requestBody: OllamaChatRequest = {
      model: this._model,
      messages: ollamaMessages,
      stream: options?.stream ?? false,
    };

    if (options?.tools && options.tools.length > 0) {
      requestBody.tools = options.tools;
    }

    logger.debug(`[Ollama] Sending chat request to ${url}`);

    try {
      if (options?.stream && options.onChunk) {
        // Handle streaming response
        return this.handleStreamingChat(url, requestBody, options.onChunk, options.signal);
      }

      const response = await httpPost<OllamaChatResponse>(url, requestBody, { timeout: 120000 });

      return this.mapResponse(response);
    } catch (error) {
      logger.error('[Ollama] Chat request failed:', error);
      throw new Error(
        `Ollama API error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Handle streaming chat response
   */
  private async handleStreamingChat(
    url: string,
    requestBody: OllamaChatRequest,
    onChunk: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<ChatResponse> {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...requestBody, stream: true }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`Ollama streaming error: ${response.status} ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    let buffer = '';
    let finalToolCalls: ChatResponse['message']['toolCalls'];
    let done = false;

    const processLine = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return;
      }

      try {
        const data = JSON.parse(trimmed) as OllamaChatResponse;
        if (data.message?.content) {
          fullContent += data.message.content;
          onChunk(data.message.content);
        }
        if (data.message?.tool_calls?.length) {
          finalToolCalls = data.message.tool_calls;
        }
        if (data.done) {
          done = true;
        }
      } catch (error) {
        logger.debug('Failed to parse Ollama response:', error);
      }
    };

    try {
      while (true) {
        // Check if abort was requested
        if (signal?.aborted) {
          logger.info('[Ollama] Streaming aborted by user');
          break;
        }

        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          processLine(line);
        }
      }

      if (buffer.trim()) {
        processLine(buffer);
      }
    } finally {
      reader.releaseLock();
    }

    return {
      message: {
        role: 'assistant',
        content: stripThinkingContent(fullContent),
        toolCalls: finalToolCalls,
      },
      done,
      finishReason: finalToolCalls?.length ? 'tool_calls' : 'stop',
    };
  }

  /**
   * Map Ollama response to internal format
   */
  private mapResponse(response: OllamaChatResponse): ChatResponse {
    return {
      message: {
        role: response.message.role,
        content: stripThinkingContent(response.message.content),
        toolCalls: response.message.tool_calls,
      },
      done: response.done,
      finishReason: response.message.tool_calls?.length ? 'tool_calls' : 'stop',
    };
  }

  /**
   * List available models from Ollama
   */
  async listModels(): Promise<Model[]> {
    const url = `${this.baseUrl}/api/tags`;

    logger.debug(`[Ollama] Listing models from ${url}`);

    try {
      const response = await http(url, { timeout: 10000 });
      if (!response.ok) {
        throw new Error(`Failed to list models: ${response.status} ${response.statusText}`);
      }
      const data = (await response.json()) as { models: Model[] };
      return data.models;
    } catch (error) {
      logger.error('[Ollama] List models failed:', error);
      throw new Error(
        `Ollama API error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Check if Ollama is available and healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/api/tags`;
      const response = await http(url, { timeout: 5000 });
      return response.ok;
    } catch (error) {
      logger.debug('Ollama health check failed:', error);
      return false;
    }
  }
}

/**
 * Create a new Ollama provider instance
 */
export function createOllamaProvider(
  baseUrl: string = DEFAULT_OLLAMA_BASE_URL,
  model: string = DEFAULT_OLLAMA_MODEL
): OllamaProvider {
  return new OllamaProvider(baseUrl, model);
}
