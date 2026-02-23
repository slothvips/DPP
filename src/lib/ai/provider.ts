// AI Model Provider - Factory and implementations for multiple providers
import { http, httpPost } from '@/lib/http';
import { logger } from '@/utils/logger';
import { DEFAULT_OLLAMA_BASE_URL, DEFAULT_OLLAMA_MODEL, OllamaProvider } from './ollama';
import type {
  AIProviderType,
  AnthropicChatMessage,
  AnthropicChatRequest,
  AnthropicChatResponse,
  ChatMessage,
  ChatOptions,
  ChatResponse,
  Model,
  ModelProvider,
  OpenAIChatMessage,
  OpenAIChatRequest,
  OpenAIChatResponse,
} from './types';
import { DEFAULT_WEBLLM_MODEL, WebLLMProvider } from './webllm';

/**
 * Default configurations for different providers
 */
export const DEFAULT_CONFIGS = {
  ollama: {
    baseUrl: DEFAULT_OLLAMA_BASE_URL,
    model: DEFAULT_OLLAMA_MODEL,
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-3-haiku-20240307',
  },
  custom: {
    baseUrl: '',
    model: '',
  },
  webllm: {
    baseUrl: '',
    model: DEFAULT_WEBLLM_MODEL,
  },
} as const;

/**
 * OpenAI-compatible provider implementation
 * Supports OpenAI API and any OpenAI-compatible third-party services
 */
export class OpenAIProvider implements ModelProvider {
  name = 'openai';
  baseUrl: string;
  apiKey: string;
  private _model: string;

  constructor(baseUrl: string, apiKey: string, model: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this._model = model;
  }

  getModelName(): string {
    return this._model;
  }

  setModel(model: string): void {
    this._model = model;
  }

  /**
   * Convert internal ChatMessage to OpenAI format
   */
  private toOpenAIMessage(message: ChatMessage): OpenAIChatMessage {
    return {
      role: message.role,
      content: message.content,
    };
  }

  /**
   * Send a chat request to OpenAI-compatible API
   */
  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    const url = `${this.baseUrl}/chat/completions`;

    const openaiMessages: OpenAIChatMessage[] = messages.map((m) => this.toOpenAIMessage(m));

    const requestBody: OpenAIChatRequest = {
      model: this._model,
      messages: openaiMessages,
      stream: options?.stream ?? false,
    };

    if (options?.temperature !== undefined) {
      requestBody.temperature = options.temperature;
    }

    logger.debug(`[OpenAI] Sending chat request to ${url}`);

    try {
      if (options?.stream && options.onChunk) {
        return this.handleStreamingChat(url, requestBody, options.onChunk);
      }

      const response = await httpPost<OpenAIChatResponse>(url, requestBody, {
        timeout: 120000,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      return this.mapResponse(response);
    } catch (error) {
      logger.error('[OpenAI] Chat request failed:', error);
      throw new Error(
        `OpenAI API error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Handle streaming chat response
   */
  private async handleStreamingChat(
    url: string,
    requestBody: OpenAIChatRequest,
    onChunk: (chunk: string) => void
  ): Promise<ChatResponse> {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...requestBody, stream: true }),
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
    let fullContent = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter((line) => line.trim() && line.startsWith('data: '));

        for (const line of lines) {
          try {
            const data = line.slice(6); // Remove 'data: ' prefix
            if (data === '[DONE]') continue;

            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta;
            if (delta?.content) {
              fullContent += delta.content;
              onChunk(delta.content);
            }
          } catch (error) {
            logger.debug('Failed to parse SSE data:', error);
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
   * Map OpenAI response to internal format
   */
  private mapResponse(response: OpenAIChatResponse): ChatResponse {
    const choice = response.choices[0];
    return {
      message: {
        role: choice.message.role,
        content: choice.message.content || '',
      },
      done: choice.finish_reason === 'stop',
    };
  }

  /**
   * List available models from OpenAI-compatible API
   */
  async listModels(): Promise<Model[]> {
    const url = `${this.baseUrl}/models`;

    logger.debug(`[OpenAI] Listing models from ${url}`);

    try {
      const response = await http(url, {
        timeout: 10000,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to list models: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as { data: { id: string }[] };
      return data.data.map((m) => ({ name: m.id }));
    } catch (error) {
      logger.error('[OpenAI] List models failed:', error);
      throw new Error(
        `OpenAI API error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

/**
 * Anthropic Claude provider implementation
 */
export class AnthropicProvider implements ModelProvider {
  name = 'anthropic';
  baseUrl: string;
  apiKey: string;
  private _model: string;

  constructor(baseUrl: string, apiKey: string, model: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this._model = model;
  }

  getModelName(): string {
    return this._model;
  }

  setModel(model: string): void {
    this._model = model;
  }

  /**
   * Convert internal ChatMessage to Anthropic format
   */
  private toAnthropicMessage(message: ChatMessage): AnthropicChatMessage {
    if (message.role === 'system') {
      // Anthropic handles system separately
      return { role: 'user', content: message.content };
    }

    return {
      role: message.role,
      content: message.content,
    };
  }

  /**
   * Send a chat request to Anthropic API
   */
  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    const url = `${this.baseUrl}/v1/messages`;

    // Extract system message if present
    const systemMessages = messages.filter((m) => m.role === 'system');
    const otherMessages = messages.filter((m) => m.role !== 'system');
    const systemContent = systemMessages.map((m) => m.content).join('\n');

    const anthropicMessages = otherMessages.map((m) => this.toAnthropicMessage(m));

    const requestBody: AnthropicChatRequest = {
      model: this._model,
      messages: anthropicMessages,
      max_tokens: 4096,
      stream: options?.stream ?? false,
    };

    if (systemContent) {
      requestBody.system = systemContent;
    }

    logger.debug(`[Anthropic] Sending chat request to ${url}`);

    try {
      if (options?.stream && options.onChunk) {
        return this.handleStreamingChat(url, requestBody, options.onChunk);
      }

      const response = await httpPost<AnthropicChatResponse>(url, requestBody, {
        timeout: 120000,
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
      });

      return this.mapResponse(response);
    } catch (error) {
      logger.error('[Anthropic] Chat request failed:', error);
      throw new Error(
        `Anthropic API error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Handle streaming chat response
   */
  private async handleStreamingChat(
    url: string,
    requestBody: AnthropicChatRequest,
    onChunk: (chunk: string) => void
  ): Promise<ChatResponse> {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...requestBody, stream: true }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic streaming error: ${response.status} - ${errorText}`);
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
        const lines = chunk.split('\n').filter((line) => line.trim() && line.startsWith('data: '));

        for (const line of lines) {
          try {
            const data = line.slice(6); // Remove 'data: ' prefix
            const parsed = JSON.parse(data);

            if (parsed.type === 'content_block_delta') {
              if (parsed.delta?.type === 'text_delta') {
                fullContent += parsed.delta.text;
                onChunk(parsed.delta.text);
              }
            }
          } catch (error) {
            logger.debug('Failed to parse SSE data:', error);
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
   * Map Anthropic response to internal format
   */
  private mapResponse(response: AnthropicChatResponse): ChatResponse {
    return {
      message: {
        role: 'assistant',
        content: response.content,
      },
      done: response.stop_reason === 'end_turn' || response.stop_reason === 'stop_sequence',
    };
  }

  /**
   * List available models from Anthropic
   * Note: Anthropic doesn't have a public models endpoint, return known models
   */
  async listModels(): Promise<Model[]> {
    // Return known Anthropic models
    const knownModels = [
      'claude-3-5-sonnet-20241022',
      'claude-3-5-sonnet-20241002',
      'claude-3-5-sonnet-20240620',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
    ];

    return knownModels.map((name) => ({ name }));
  }
}

/**
 * Custom OpenAI-compatible provider
 * Supports any third-party service that implements OpenAI API
 */
export class CustomProvider extends OpenAIProvider {
  name = 'custom';

  constructor(baseUrl: string, apiKey: string, model: string) {
    super(baseUrl, apiKey, model);
  }
}

/**
 * Create a provider instance based on configuration
 */
export function createProvider(
  providerType: AIProviderType,
  baseUrl: string,
  model: string,
  apiKey?: string
): ModelProvider {
  switch (providerType) {
    case 'ollama':
      return new OllamaProvider(baseUrl, model);
    case 'openai':
    case 'custom':
      return new OpenAIProvider(baseUrl, apiKey || '', model);
    case 'anthropic':
      return new AnthropicProvider(baseUrl, apiKey || '', model);
    case 'webllm':
      return new WebLLMProvider(model);
    default:
      logger.warn(`[AI Provider] Unknown provider type: ${providerType}, falling back to Ollama`);
      return new OllamaProvider(baseUrl, model);
  }
}
