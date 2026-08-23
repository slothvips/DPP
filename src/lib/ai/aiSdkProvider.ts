import { generateText, jsonSchema, streamText, tool } from 'ai';
import type { LanguageModel, ModelMessage, ToolSet } from 'ai';
import type { ToolChoice } from 'ai';
import { createTokenUsage } from './tokenUsage';
import type {
  ChatMessage,
  ChatOptions,
  ChatResponse,
  Model,
  ModelProvider,
  OpenAIToolCall,
  OpenAIToolChoice,
  OpenAIToolDefinition,
  ProviderMessageMetadata,
} from './types';

interface AiSdkProviderOptions {
  name: string;
  baseUrl: string;
  model: string;
  createModel: (model: string) => LanguageModel;
}

function parseToolInput(value: string): unknown {
  if (!value.trim()) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function toModelMessages(messages: ChatMessage[]): ModelMessage[] {
  return messages.flatMap((message): ModelMessage[] => {
    if (message.role === 'assistant' && message.providerMetadata?.aiSdkResponseMessages?.length) {
      return message.providerMetadata.aiSdkResponseMessages as ModelMessage[];
    }

    if (message.role === 'assistant' && message.toolCalls?.length) {
      return [
        {
          role: 'assistant',
          content: [
            ...(message.content ? [{ type: 'text' as const, text: message.content }] : []),
            ...message.toolCalls.map((toolCall) => ({
              type: 'tool-call' as const,
              toolCallId: toolCall.id,
              toolName: toolCall.function.name,
              input: parseToolInput(toolCall.function.arguments),
            })),
          ],
        },
      ];
    }

    if (message.role === 'tool') {
      return [
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: message.toolCallId || '',
              toolName: message.name || 'unknown_tool',
              output: { type: 'text', value: message.content },
            },
          ],
        },
      ];
    }

    if (message.role === 'user' && message.images?.length) {
      return [
        {
          role: 'user',
          content: [
            { type: 'text', text: message.content },
            ...message.images.map((image) => ({
              type: 'image' as const,
              image: `data:${image.mediaType};base64,${image.data}`,
            })),
          ],
        },
      ];
    }

    return [{ role: message.role, content: message.content } as ModelMessage];
  });
}

function toToolSet(definitions?: OpenAIToolDefinition[]): ToolSet | undefined {
  if (!definitions?.length) {
    return undefined;
  }

  return Object.fromEntries(
    definitions.map((definition) => [
      definition.function.name,
      tool({
        description: definition.function.description,
        inputSchema: jsonSchema(
          definition.function.parameters as unknown as Parameters<typeof jsonSchema>[0]
        ),
      }),
    ])
  );
}

function toAiSdkToolChoice(toolChoice?: OpenAIToolChoice | null): ToolChoice<ToolSet> | undefined {
  if (toolChoice && typeof toolChoice === 'object') {
    return { type: 'tool', toolName: toolChoice.function.name };
  }
  return toolChoice || undefined;
}

function toOpenAIToolCalls(
  calls: ReadonlyArray<{ toolCallId: string; toolName: string; input: unknown }>
): OpenAIToolCall[] | undefined {
  if (calls.length === 0) {
    return undefined;
  }

  return calls.map((call) => ({
    id: call.toolCallId,
    type: 'function',
    function: {
      name: call.toolName,
      arguments: JSON.stringify(call.input) || '{}',
    },
  }));
}

function createMetadata(responseMessages: unknown[]): ProviderMessageMetadata | undefined {
  return responseMessages.length > 0 ? { aiSdkResponseMessages: responseMessages } : undefined;
}

export class AiSdkProvider implements ModelProvider {
  name: string;
  baseUrl: string;
  private _model: string;
  private readonly createModel: (model: string) => LanguageModel;

  constructor(options: AiSdkProviderOptions) {
    this.name = options.name;
    this.baseUrl = options.baseUrl;
    this._model = options.model;
    this.createModel = options.createModel;
  }

  getModelName(): string {
    return this._model;
  }

  setModel(model: string): void {
    this._model = model;
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    const request = {
      model: this.createModel(this._model),
      messages: toModelMessages(messages),
      tools: toToolSet(options?.tools),
      toolChoice: toAiSdkToolChoice(options?.toolChoice),
      temperature: options?.temperature,
      reasoning: options?.providerOptions?.reasoningEffort,
      abortSignal: options?.signal,
      maxRetries: 0,
    } as const;

    if (options?.stream && options.onChunk) {
      const result = streamText(request);
      for await (const chunk of result.textStream) {
        options.onChunk(chunk);
      }

      const [text, toolCalls, finishReason, response, usage] = await Promise.all([
        result.text,
        result.toolCalls,
        result.finishReason,
        result.response,
        result.usage,
      ]);

      return {
        message: {
          role: 'assistant',
          content: text,
          toolCalls: toOpenAIToolCalls(toolCalls),
          providerMetadata: createMetadata(response.messages),
        },
        done: finishReason === 'stop' || finishReason === 'tool-calls',
        finishReason,
        usage: createTokenUsage({
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          cachedInputTokens: usage.inputTokenDetails.cacheReadTokens,
          cacheWriteInputTokens: usage.inputTokenDetails.cacheWriteTokens,
        }),
      };
    }

    const result = await generateText(request);
    return {
      message: {
        role: 'assistant',
        content: result.text,
        toolCalls: toOpenAIToolCalls(result.toolCalls),
        providerMetadata: createMetadata(result.response.messages),
      },
      done: result.finishReason === 'stop' || result.finishReason === 'tool-calls',
      finishReason: result.finishReason,
      usage: createTokenUsage({
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        cachedInputTokens: result.usage.inputTokenDetails.cacheReadTokens,
        cacheWriteInputTokens: result.usage.inputTokenDetails.cacheWriteTokens,
      }),
    };
  }

  async listModels(): Promise<Model[]> {
    return [{ name: this._model }];
  }
}
