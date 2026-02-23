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

    logger.debug(`[Ollama] Sending chat request to ${url}`);

    try {
      if (options?.stream && options.onChunk) {
        // Handle streaming response
        return this.handleStreamingChat(url, requestBody, options.onChunk);
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
    onChunk: (chunk: string) => void
  ): Promise<ChatResponse> {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...requestBody, stream: true }),
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

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter((line) => line.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.message?.content) {
              fullContent += data.message.content;
              onChunk(data.message.content);
            }
          } catch (error) {
            logger.debug('Failed to parse Ollama response:', error);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return {
      message: {
        role: 'assistant',
        content: fullContent,
      },
      done: true,
    };
  }

  /**
   * Map Ollama response to internal format
   */
  private mapResponse(response: OllamaChatResponse): ChatResponse {
    return {
      message: {
        role: response.message.role,
        content: response.message.content,
      },
      done: response.done,
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
