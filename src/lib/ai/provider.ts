// AI Model Provider - Factory and implementations for multiple providers
import { http, httpPost } from '@/lib/http';
import { logger } from '@/utils/logger';
import {
  DEFAULT_OLLAMA_BASE_URL,
  DEFAULT_OLLAMA_MODEL,
  OllamaProvider,
  stripThinkingContent,
} from './ollama';
import type {
  AIProviderType,
  AnthropicChatMessage,
  AnthropicChatRequest,
  AnthropicChatResponse,
  AnthropicMessageContentBlock,
  AnthropicToolDefinition,
  ChatMessage,
  ChatOptions,
  ChatResponse,
  Model,
  ModelProvider,
  OpenAIChatMessage,
  OpenAIChatRequest,
  OpenAIChatResponse,
  OpenAIToolCall,
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

function mapOpenAIToolCalls(toolCalls?: OpenAIToolCall[]): OpenAIToolCall[] | undefined {
  if (!toolCalls?.length) return undefined;
  return toolCalls.map((toolCall) => ({
    id: toolCall.id,
    type: 'function',
    function: {
      name: toolCall.function.name,
      arguments: toolCall.function.arguments,
    },
  }));
}

function openAIToolChoice(
  toolChoice: ChatOptions['toolChoice'] | undefined
): OpenAIChatRequest['tool_choice'] | undefined {
  return toolChoice;
}

function anthropicTools(options?: ChatOptions): AnthropicToolDefinition[] | undefined {
  if (!options?.tools?.length) return undefined;
  return options.tools.map((tool) => ({
    name: tool.function.name,
    description: tool.function.description,
    input_schema: tool.function.parameters,
  }));
}

function anthropicToolDefinitionsToOpenAI(
  tools?: AnthropicToolDefinition[]
): OpenAIChatRequest['tools'] | undefined {
  if (!tools?.length) {
    return undefined;
  }

  return tools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
    },
  }));
}

function anthropicMessageToOpenAIMessage(message: AnthropicChatMessage): OpenAIChatMessage {
  if (typeof message.content === 'string') {
    return {
      role: message.role,
      content: message.content,
    };
  }

  const textContent = message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');

  const openAIMessage: OpenAIChatMessage = {
    role: message.role,
    content: textContent,
  };

  const toolResultBlock = message.content.find((block) => block.type === 'tool_result');
  if (toolResultBlock?.type === 'tool_result') {
    openAIMessage.role = 'tool';
    openAIMessage.content = toolResultBlock.content;
    openAIMessage.tool_call_id = toolResultBlock.tool_use_id;
    return openAIMessage;
  }

  const toolUseBlocks = message.content.filter((block) => block.type === 'tool_use');
  if (toolUseBlocks.length) {
    openAIMessage.tool_calls = toolUseBlocks.map((block) => ({
      id: block.id,
      type: 'function',
      function: {
        name: block.name,
        arguments: JSON.stringify(block.input),
      },
    }));
  }

  return openAIMessage;
}

function anthropicMessagesToOpenAIMessages(messages: AnthropicChatMessage[]): OpenAIChatMessage[] {
  return messages.map(anthropicMessageToOpenAIMessage);
}

function buildAnthropicOpenAIRequest(
  model: string,
  messages: AnthropicChatMessage[],
  systemContent: string,
  tools?: AnthropicToolDefinition[]
): OpenAIChatRequest {
  const openaiRequest: OpenAIChatRequest = {
    model,
    messages: [],
  };

  if (systemContent) {
    openaiRequest.messages.push({ role: 'system', content: systemContent });
  }

  openaiRequest.messages.push(...anthropicMessagesToOpenAIMessages(messages));

  const openAITools = anthropicToolDefinitionsToOpenAI(tools);
  if (openAITools?.length) {
    openaiRequest.tools = openAITools;
    openaiRequest.tool_choice = 'auto';
  }

  return openaiRequest;
}

function mergeStreamedValue(current: string, next?: string): string {
  if (!next) {
    return current;
  }
  if (!current) {
    return next;
  }
  if (next.startsWith(current)) {
    return next;
  }
  if (current.endsWith(next)) {
    return current;
  }
  return current + next;
}

function resolveStreamingToolCallKey(
  partialToolCall: { id?: string; index?: number },
  toolCallLookup: Map<string, OpenAIToolCall>,
  toolCallKeyByIndex: Map<number, string>
): string {
  if (partialToolCall.id) {
    if (partialToolCall.index !== undefined) {
      const existingKey = toolCallKeyByIndex.get(partialToolCall.index);
      if (existingKey && existingKey !== partialToolCall.id) {
        const existingToolCall = toolCallLookup.get(existingKey);
        if (existingToolCall && !toolCallLookup.has(partialToolCall.id)) {
          toolCallLookup.set(partialToolCall.id, existingToolCall);
        }
        toolCallLookup.delete(existingKey);
      }
      toolCallKeyByIndex.set(partialToolCall.index, partialToolCall.id);
    }
    return partialToolCall.id;
  }

  if (partialToolCall.index !== undefined) {
    const existingKey = toolCallKeyByIndex.get(partialToolCall.index);
    if (existingKey) {
      return existingKey;
    }

    const indexKey = String(partialToolCall.index);
    toolCallKeyByIndex.set(partialToolCall.index, indexKey);
    return indexKey;
  }

  return String(toolCallLookup.size);
}

function extractSSEEventBlocks(buffer: string): { events: string[]; remainder: string } {
  const normalized = buffer.replace(/\r\n/g, '\n');
  const parts = normalized.split('\n\n');
  const remainder = parts.pop() ?? '';
  return {
    events: parts,
    remainder,
  };
}

function getSSEDataPayload(eventBlock: string): string | null {
  const dataLines = eventBlock
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim());

  if (dataLines.length === 0) {
    return null;
  }

  return dataLines.join('\n');
}

function normalizeToolArgumentsJson(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return '{}';
  }

  const parsed = JSON.parse(trimmed) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Tool arguments must be a JSON object');
  }

  return JSON.stringify(parsed);
}

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
      name: message.name,
      tool_call_id: message.toolCallId,
      tool_calls: mapOpenAIToolCalls(message.toolCalls),
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

    if (options?.tools?.length) {
      requestBody.tools = options.tools;
      requestBody.tool_choice = openAIToolChoice(options.toolChoice) || 'auto';
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
    let buffer = '';
    const toolCallLookup = new Map<string, OpenAIToolCall>();
    const toolCallKeyByIndex = new Map<number, string>();
    let finishReason: string | null = null;

    const processEventBlock = (eventBlock: string) => {
      try {
        const data = getSSEDataPayload(eventBlock);
        if (!data || data === '[DONE]') return;

        const parsed = JSON.parse(data) as {
          choices?: {
            delta?: {
              content?: string;
              tool_calls?: Array<{
                index?: number;
                id?: string;
                type?: 'function';
                function?: {
                  name?: string;
                  arguments?: string;
                };
              }>;
            };
            message?: {
              content?: string | null;
              tool_calls?: OpenAIToolCall[];
            };
            finish_reason?: string | null;
          }[];
        };
        const choice = parsed.choices?.[0];
        const delta = choice?.delta;

        if (delta?.content) {
          fullContent += delta.content;
          onChunk(delta.content);
        } else if (choice?.message?.content && !fullContent) {
          fullContent = choice.message.content;
        }

        for (const partialToolCall of delta?.tool_calls || []) {
          const key = resolveStreamingToolCallKey(
            partialToolCall,
            toolCallLookup,
            toolCallKeyByIndex
          );
          const existing = toolCallLookup.get(key) || {
            id: partialToolCall.id || key,
            type: 'function' as const,
            function: {
              name: '',
              arguments: '',
            },
          };

          if (partialToolCall.id) {
            existing.id = partialToolCall.id;
          }
          if (partialToolCall.function?.name) {
            existing.function.name = mergeStreamedValue(
              existing.function.name,
              partialToolCall.function.name
            );
          }
          if (partialToolCall.function?.arguments) {
            existing.function.arguments = mergeStreamedValue(
              existing.function.arguments,
              partialToolCall.function.arguments
            );
          }

          toolCallLookup.set(key, existing);
        }

        if (choice?.message?.tool_calls?.length) {
          choice.message.tool_calls.forEach((toolCall, index) => {
            const key = resolveStreamingToolCallKey(
              { id: toolCall.id, index },
              toolCallLookup,
              toolCallKeyByIndex
            );
            toolCallLookup.set(key, {
              id: toolCall.id || key,
              type: 'function',
              function: {
                name: toolCall.function.name,
                arguments: toolCall.function.arguments,
              },
            });
          });
        }

        if (choice?.finish_reason !== undefined) {
          finishReason = choice.finish_reason;
        }
      } catch (error) {
        logger.debug('Failed to parse SSE data:', error);
      }
    };

    try {
      while (true) {
        if (signal?.aborted) {
          logger.info('[OpenAI] Streaming aborted by user');
          break;
        }

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const { events, remainder } = extractSSEEventBlocks(buffer);
        buffer = remainder;

        for (const eventBlock of events) {
          processEventBlock(eventBlock);
        }
      }

      if (buffer.trim()) {
        processEventBlock(buffer);
      }
    } finally {
      reader.releaseLock();
    }

    const finalToolCalls = Array.from(toolCallLookup.values()).map((toolCall) => ({
      ...toolCall,
      function: {
        ...toolCall.function,
        arguments: normalizeToolArgumentsJson(toolCall.function.arguments),
      },
    }));

    return {
      message: {
        role: 'assistant',
        content: stripThinkingContent(fullContent),
        toolCalls: finalToolCalls.length ? finalToolCalls : undefined,
      },
      done: true,
      finishReason,
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
        content: stripThinkingContent(choice.message.content || ''),
        toolCalls: mapOpenAIToolCalls(choice.message.tool_calls),
      },
      done: choice.finish_reason === 'stop' || choice.finish_reason === 'tool_calls',
      finishReason: choice.finish_reason,
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
      return { role: 'user', content: message.content };
    }

    if (message.role === 'tool') {
      return {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: message.toolCallId || '',
            content: message.content,
          },
        ],
      };
    }

    if (message.role === 'assistant' && message.toolCalls?.length) {
      const content: AnthropicMessageContentBlock[] = [];
      if (message.content) {
        content.push({ type: 'text', text: message.content });
      }
      for (const toolCall of message.toolCalls) {
        content.push({
          type: 'tool_use',
          id: toolCall.id,
          name: toolCall.function.name,
          input: JSON.parse(toolCall.function.arguments),
        });
      }
      return {
        role: 'assistant',
        content,
      };
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

    const tools = anthropicTools(options);
    if (tools?.length) {
      requestBody.tools = tools;
    }

    logger.debug(`[Anthropic] Sending chat request to ${this.baseUrl}`);

    try {
      if (options?.stream && options.onChunk) {
        return this.handleStreamingChat(requestBody, options.onChunk, options.signal);
      }

      const nativeUrl = `${this.baseUrl}/v1/messages`;
      logger.debug(`[Anthropic] Trying native endpoint: ${nativeUrl}`);

      let response: AnthropicChatResponse | OpenAIChatResponse | null = await this.tryRequest(
        nativeUrl,
        requestBody
      );

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
    const openaiRequest = buildAnthropicOpenAIRequest(
      this._model,
      anthropicRequest.messages,
      systemContent,
      anthropicRequest.tools
    );

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

    if (!response) {
      const openaiUrl = `${this.baseUrl}/v1/chat/completions`;
      logger.debug(`[Anthropic] Trying OpenAI-compatible streaming endpoint: ${openaiUrl}`);

      const openaiRequest = buildAnthropicOpenAIRequest(
        requestBody.model,
        requestBody.messages,
        requestBody.system || '',
        requestBody.tools
      );

      response = await fetch(openaiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...openaiRequest,
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
    let finishReason: string | null = null;
    const anthropicToolCallLookup = new Map<string, OpenAIToolCall>();
    const openAIToolCallLookup = new Map<string, OpenAIToolCall>();
    const openAIToolCallKeyByIndex = new Map<number, string>();

    const processEventBlock = (eventBlock: string) => {
      const data = getSSEDataPayload(eventBlock);
      if (!data || data === '[DONE]') {
        return;
      }

      try {
        const parsed = JSON.parse(data) as {
          type?: string;
          delta?: { type?: string; text?: string; thinking?: string; partial_json?: string };
          content_block?: { type?: string; id?: string; name?: string };
          choices?: {
            delta?: {
              content?: string;
              tool_calls?: Array<{
                index?: number;
                id?: string;
                type?: 'function';
                function?: { name?: string; arguments?: string };
              }>;
            };
            message?: {
              content?: string | null;
              tool_calls?: OpenAIToolCall[];
            };
            finish_reason?: string | null;
          }[];
        };

        if (parsed.type === 'content_block_delta') {
          if (parsed.delta?.type === 'text_delta' && parsed.delta.text) {
            fullContent += parsed.delta.text;
            onChunk(parsed.delta.text);
          } else if (parsed.delta?.type === 'thinking_delta' && parsed.delta.thinking) {
            fullContent += parsed.delta.thinking;
            onChunk(parsed.delta.thinking);
          } else if (parsed.delta?.type === 'input_json_delta' && parsed.delta.partial_json) {
            const lastToolCall = Array.from(anthropicToolCallLookup.values()).at(-1);
            if (lastToolCall) {
              lastToolCall.function.arguments += parsed.delta.partial_json;
            }
          }
        } else if (parsed.type === 'content_block_start') {
          if (parsed.content_block?.type === 'tool_use') {
            const toolCall: OpenAIToolCall = {
              id: parsed.content_block.id || crypto.randomUUID(),
              type: 'function',
              function: {
                name: parsed.content_block.name || '',
                arguments: '',
              },
            };
            anthropicToolCallLookup.set(toolCall.id, toolCall);
          }
        } else if (parsed.choices?.[0]?.delta?.content) {
          const content = parsed.choices[0].delta.content;
          fullContent += content;
          onChunk(content);
        } else if (parsed.choices?.[0]?.message?.content && !fullContent) {
          fullContent = parsed.choices[0].message.content;
        }

        if (parsed.choices?.[0]?.message?.tool_calls?.length) {
          parsed.choices[0].message.tool_calls.forEach((toolCall, index) => {
            const key = resolveStreamingToolCallKey(
              { id: toolCall.id, index },
              openAIToolCallLookup,
              openAIToolCallKeyByIndex
            );
            openAIToolCallLookup.set(key, {
              id: toolCall.id || key,
              type: 'function',
              function: {
                name: toolCall.function.name,
                arguments: toolCall.function.arguments,
              },
            });
          });
        }

        for (const partialToolCall of parsed.choices?.[0]?.delta?.tool_calls || []) {
          const key = resolveStreamingToolCallKey(
            partialToolCall,
            openAIToolCallLookup,
            openAIToolCallKeyByIndex
          );
          const existing = openAIToolCallLookup.get(key) || {
            id: partialToolCall.id || key,
            type: 'function' as const,
            function: {
              name: '',
              arguments: '',
            },
          };

          if (partialToolCall.id) {
            existing.id = partialToolCall.id;
          }
          if (partialToolCall.function?.name) {
            existing.function.name = mergeStreamedValue(
              existing.function.name,
              partialToolCall.function.name
            );
          }
          if (partialToolCall.function?.arguments) {
            existing.function.arguments = mergeStreamedValue(
              existing.function.arguments,
              partialToolCall.function.arguments
            );
          }

          openAIToolCallLookup.set(key, existing);
        }

        if (parsed.choices?.[0]?.finish_reason !== undefined) {
          finishReason = parsed.choices[0].finish_reason;
        }
      } catch (error) {
        logger.debug('[Anthropic] Failed to parse SSE data:', error);
      }
    };

    try {
      while (true) {
        if (signal?.aborted) {
          logger.info('[Anthropic] Streaming aborted by user');
          break;
        }

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const { events, remainder } = extractSSEEventBlocks(buffer);
        buffer = remainder;

        for (const eventBlock of events) {
          processEventBlock(eventBlock);
        }
      }

      if (buffer.trim()) {
        processEventBlock(buffer);
      }
    } finally {
      reader.releaseLock();
    }

    logger.debug(`[Anthropic] Streaming complete, total content length: ${fullContent.length}`);

    const anthropicToolCalls = Array.from(anthropicToolCallLookup.values()).map((toolCall) => ({
      ...toolCall,
      function: {
        ...toolCall.function,
        arguments: normalizeToolArgumentsJson(toolCall.function.arguments),
      },
    }));

    const openAIToolCalls = Array.from(openAIToolCallLookup.values()).map((toolCall) => ({
      ...toolCall,
      function: {
        ...toolCall.function,
        arguments: normalizeToolArgumentsJson(toolCall.function.arguments),
      },
    }));

    const finalToolCalls = anthropicToolCalls.length > 0 ? anthropicToolCalls : openAIToolCalls;

    return {
      message: {
        role: 'assistant',
        content: stripThinkingContent(fullContent),
        toolCalls: finalToolCalls.length ? finalToolCalls : undefined,
      },
      done: true,
      finishReason,
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
          content: stripThinkingContent(choice.message?.content || ''),
          toolCalls: mapOpenAIToolCalls(choice.message.tool_calls),
        },
        done: choice.finish_reason === 'stop' || choice.finish_reason === 'tool_calls',
        finishReason: choice.finish_reason,
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

    const toolCalls = response.content
      .filter(
        (block): block is Extract<typeof block, { type: 'tool_use' }> => block.type === 'tool_use'
      )
      .map((block) => ({
        id: block.id,
        type: 'function' as const,
        function: {
          name: block.name,
          arguments: JSON.stringify(block.input),
        },
      }));

    return {
      message: {
        role: 'assistant',
        content: stripThinkingContent(textContent),
        toolCalls: toolCalls.length ? toolCalls : undefined,
      },
      done: response.stop_reason === 'end_turn' || response.stop_reason === 'stop_sequence',
      finishReason: response.stop_reason,
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
