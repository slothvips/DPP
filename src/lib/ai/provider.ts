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

/**
 * Default configurations for different providers
 */
export const DEFAULT_CONFIGS = {
  ollama: {
    baseUrl: DEFAULT_OLLAMA_BASE_URL,
    model: DEFAULT_OLLAMA_MODEL,
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-3-haiku-20240307',
  },
  custom: {
    baseUrl: '',
    model: '',
  },
} as const;

/**
 * OpenAI-compatible provider implementation
 * Supports any OpenAI-compatible third-party services
 */
export class OpenAICompatibleProvider implements ModelProvider {
  name = 'custom';
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
        return this.handleStreamingChat(url, requestBody, options.onChunk, options.signal);
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
    onChunk: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<ChatResponse> {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...requestBody, stream: true }),
      signal,
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
        // Check if abort was requested
        if (signal?.aborted) {
          logger.info('[OpenAI] Streaming aborted by user');
          break;
        }

        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter((line) => {
          const trimmed = line.trim();
          return trimmed && trimmed.startsWith('data:');
        });

        for (const line of lines) {
          try {
            const data = line.slice(5).trim();
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
 * Anthropic-compatible provider implementation
 * Supports native Anthropic API and OpenAI-compatible third-party services
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

    logger.debug(`[Anthropic] Sending chat request to ${this.baseUrl}`);

    try {
      if (options?.stream && options.onChunk) {
        return this.handleStreamingChat(requestBody, options.onChunk, options.signal);
      }

      // Try native Anthropic endpoint first
      const nativeUrl = `${this.baseUrl}/v1/messages`;
      logger.debug(`[Anthropic] Trying native endpoint: ${nativeUrl}`);

      let response: AnthropicChatResponse | OpenAIChatResponse | null = await this.tryRequest(
        nativeUrl,
        requestBody
      );

      // If native endpoint fails with 404, try OpenAI-compatible endpoint
      if (!response) {
        const openaiUrl = `${this.baseUrl}/v1/chat/completions`;
        logger.debug(`[Anthropic] Trying OpenAI-compatible endpoint: ${openaiUrl}`);
        response = await this.tryOpenAIRequest(openaiUrl, requestBody, systemContent);
      }

      if (!response) {
        throw new Error('Both native and OpenAI-compatible endpoints failed');
      }

      return this.mapResponse(response);
    } catch (error) {
      logger.error('[Anthropic] Chat request failed:', error);
      throw new Error(
        `Anthropic API error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Try native Anthropic request
   */
  private async tryRequest(
    url: string,
    requestBody: AnthropicChatRequest
  ): Promise<AnthropicChatResponse | null> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
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

  /**
   * Try OpenAI-compatible request
   */
  private async tryOpenAIRequest(
    url: string,
    anthropicRequest: AnthropicChatRequest,
    systemContent: string
  ): Promise<OpenAIChatResponse | null> {
    // Convert Anthropic request to OpenAI format
    const openaiRequest: OpenAIChatRequest = {
      model: this._model,
      messages: [],
    };

    if (systemContent) {
      openaiRequest.messages.push({ role: 'system', content: systemContent });
    }

    for (const msg of anthropicRequest.messages) {
      openaiRequest.messages.push({ role: msg.role, content: msg.content });
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(openaiRequest),
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

  /**
   * Handle streaming chat response
   * Supports both native Anthropic and OpenAI-compatible streaming formats
   */
  private async handleStreamingChat(
    requestBody: AnthropicChatRequest,
    onChunk: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<ChatResponse> {
    // Try native Anthropic endpoint first
    const nativeUrl = `${this.baseUrl}/v1/messages`;
    logger.debug(`[Anthropic] Trying native streaming endpoint: ${nativeUrl}`);

    let response: Response | null = null;

    try {
      response = await fetch(nativeUrl, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
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

    // If native endpoint fails, try OpenAI-compatible endpoint
    if (!response) {
      const openaiUrl = `${this.baseUrl}/v1/chat/completions`;
      logger.debug(`[Anthropic] Trying OpenAI-compatible streaming endpoint: ${openaiUrl}`);

      const openaiMessages: OpenAIChatMessage[] = [];
      if (requestBody.system) {
        openaiMessages.push({ role: 'system', content: requestBody.system });
      }
      for (const msg of requestBody.messages) {
        openaiMessages.push({ role: msg.role, content: msg.content });
      }

      response = await fetch(openaiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: requestBody.model,
          messages: openaiMessages,
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
    let fullContent = '';
    let buffer = '';

    try {
      while (true) {
        // Check if abort was requested
        if (signal?.aborted) {
          logger.info('[Anthropic] Streaming aborted by user');
          break;
        }

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;

          logger.debug(`[Anthropic] SSE line: ${trimmedLine}`);

          try {
            if (trimmedLine.startsWith('data:')) {
              const data = trimmedLine.slice(5).trim();
              if (data === '[DONE]') continue;

              const parsed = JSON.parse(data);
              logger.debug(`[Anthropic] Parsed SSE: type=${parsed.type}`);

              if (parsed.type === 'content_block_delta') {
                if (parsed.delta?.type === 'text_delta') {
                  const text = parsed.delta.text;
                  logger.debug(`[Anthropic] Text chunk: "${text}"`);
                  fullContent += text;
                  onChunk(text);
                } else if (parsed.delta?.type === 'thinking_delta') {
                  const thinking = parsed.delta.thinking;
                  logger.debug(`[Anthropic] Thinking chunk: "${thinking?.slice(0, 50)}..."`);
                  fullContent += thinking;
                  onChunk(thinking);
                }
              } else if (parsed.choices?.[0]?.delta?.content) {
                const content = parsed.choices[0].delta.content;
                logger.debug(`[Anthropic] OpenAI chunk: "${content}"`);
                fullContent += content;
                onChunk(content);
              }
            }
          } catch (error) {
            logger.debug('[Anthropic] Failed to parse SSE data:', error);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    logger.debug(`[Anthropic] Streaming complete, total content length: ${fullContent.length}`);

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
   * Supports both native Anthropic and OpenAI-compatible response formats
   */
  private mapResponse(response: AnthropicChatResponse | OpenAIChatResponse): ChatResponse {
    if ('choices' in response) {
      const choice = response.choices[0];
      return {
        message: {
          role: 'assistant',
          content: choice.message?.content || '',
        },
        done: choice.finish_reason === 'stop',
      };
    }

    const textContent = response.content
      .map((block) => {
        if (block.type === 'text') {
          return block.text;
        }
        if (block.type === 'thinking') {
          return block.thinking;
        }
        return '';
      })
      .filter(Boolean)
      .join('');

    return {
      message: {
        role: 'assistant',
        content: textContent,
      },
      done: response.stop_reason === 'end_turn' || response.stop_reason === 'stop_sequence',
    };
  }

  /**
   * List available models from Anthropic
   * Note: Anthropic doesn't have a public models endpoint, return known models
   */
  async listModels(): Promise<Model[]> {
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
    case 'custom':
      return new OpenAICompatibleProvider(baseUrl, apiKey || '', model);
    case 'anthropic':
      return new AnthropicProvider(baseUrl, apiKey || '', model);
    default:
      logger.warn(`[AI Provider] Unknown provider type: ${providerType}, falling back to Ollama`);
      return new OllamaProvider(baseUrl, model);
  }
}
