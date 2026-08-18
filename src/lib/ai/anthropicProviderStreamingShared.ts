import { stripThinkingContent } from './ollama';
import { normalizeToolArgumentsJsonOrOriginal } from './providerShared';
import { createTokenUsage } from './tokenUsage';
import type {
  AnthropicChatResponse,
  AnthropicResponseContentBlock,
  ChatResponse,
  OpenAIChatResponse,
  OpenAIToolCall,
} from './types';

interface PartialStreamingToolCall {
  id?: string;
  function?: {
    name?: string;
    arguments?: string;
  };
}

export interface AnthropicStreamingState {
  fullContent: string;
  openAIReasoningContent: string;
  finishReason: string | null;
  anthropicToolCallLookup: Map<string, OpenAIToolCall>;
  openAIToolCallLookup: Map<string, OpenAIToolCall>;
  openAIToolCallKeyByIndex: Map<number, string>;
  responseContentBlocks: AnthropicResponseContentBlock[];
  currentThinkingBlock: Extract<AnthropicResponseContentBlock, { type: 'thinking' }> | null;
  currentToolUseBlock: Extract<AnthropicResponseContentBlock, { type: 'tool_use' }> | null;
  currentToolUseJsonBuffer: string;
  model: string;
  anthropicUsage?: AnthropicChatResponse['usage'];
  openAIUsage?: OpenAIChatResponse['usage'];
}

export function createAnthropicStreamingState(model: string): AnthropicStreamingState {
  return {
    fullContent: '',
    openAIReasoningContent: '',
    finishReason: null,
    anthropicToolCallLookup: new Map<string, OpenAIToolCall>(),
    openAIToolCallLookup: new Map<string, OpenAIToolCall>(),
    openAIToolCallKeyByIndex: new Map<number, string>(),
    responseContentBlocks: [],
    currentThinkingBlock: null,
    currentToolUseBlock: null,
    currentToolUseJsonBuffer: '',
    model,
  };
}

export function mergeAnthropicStreamingUsage(
  state: AnthropicStreamingState,
  usage: Partial<AnthropicChatResponse['usage']>
) {
  state.anthropicUsage = {
    input_tokens: usage.input_tokens ?? state.anthropicUsage?.input_tokens ?? 0,
    output_tokens: usage.output_tokens ?? state.anthropicUsage?.output_tokens ?? 0,
    cache_creation_input_tokens:
      usage.cache_creation_input_tokens ?? state.anthropicUsage?.cache_creation_input_tokens,
    cache_read_input_tokens:
      usage.cache_read_input_tokens ?? state.anthropicUsage?.cache_read_input_tokens,
  };
}

export function setAnthropicOpenAIStreamingUsage(
  state: AnthropicStreamingState,
  usage: OpenAIChatResponse['usage']
) {
  state.openAIUsage = usage;
}

export function appendAnthropicStreamingContent(
  state: AnthropicStreamingState,
  chunk: string,
  onChunk: (chunk: string) => void
) {
  state.fullContent += chunk;
  onChunk(chunk);
}

export function setAnthropicStreamingFallbackContent(
  state: AnthropicStreamingState,
  content: string | null | undefined
) {
  if (content && !state.fullContent) {
    state.fullContent = content;
  }
}

export function appendAnthropicOpenAIReasoningContent(
  state: AnthropicStreamingState,
  content: string
) {
  state.openAIReasoningContent += content;
}

export function getLatestAnthropicToolCall(
  state: AnthropicStreamingState
): OpenAIToolCall | undefined {
  return Array.from(state.anthropicToolCallLookup.values()).at(-1);
}

export function upsertOpenAIStreamingToolCall(options: {
  state: AnthropicStreamingState;
  key: string;
  partialToolCall: PartialStreamingToolCall;
  mergeValue: (currentValue: string, incomingValue: string) => string;
}) {
  const { state, key, partialToolCall, mergeValue } = options;

  const existing = state.openAIToolCallLookup.get(key) || {
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
    existing.function.name = mergeValue(existing.function.name, partialToolCall.function.name);
  }
  if (partialToolCall.function?.arguments) {
    existing.function.arguments = mergeValue(
      existing.function.arguments,
      partialToolCall.function.arguments
    );
  }

  state.openAIToolCallLookup.set(key, existing);
}

export function appendAnthropicResponseContentBlock(
  state: AnthropicStreamingState,
  block: AnthropicResponseContentBlock
) {
  state.responseContentBlocks.push(block);
}

export function buildAnthropicStreamingResponse(state: AnthropicStreamingState): ChatResponse {
  const anthropicToolCalls = Array.from(state.anthropicToolCallLookup.values()).map((toolCall) => ({
    ...toolCall,
    function: {
      ...toolCall.function,
      arguments: normalizeToolArgumentsJsonOrOriginal(toolCall.function.arguments),
    },
  }));

  const openAIToolCalls = Array.from(state.openAIToolCallLookup.values()).map((toolCall) => ({
    ...toolCall,
    function: {
      ...toolCall.function,
      arguments: normalizeToolArgumentsJsonOrOriginal(toolCall.function.arguments),
    },
  }));

  const finalToolCalls = anthropicToolCalls.length > 0 ? anthropicToolCalls : openAIToolCalls;
  const cachedInputTokens = state.anthropicUsage?.cache_read_input_tokens;
  const cacheWriteInputTokens = state.anthropicUsage?.cache_creation_input_tokens;
  const anthropicInputTokens = state.anthropicUsage
    ? state.anthropicUsage.input_tokens + (cachedInputTokens ?? 0) + (cacheWriteInputTokens ?? 0)
    : undefined;

  return {
    message: {
      role: 'assistant',
      content: stripThinkingContent(state.fullContent),
      toolCalls: finalToolCalls.length ? finalToolCalls : undefined,
      providerMetadata: {
        anthropicContentBlocks: state.responseContentBlocks,
        openAIReasoningContent: state.openAIReasoningContent || undefined,
      },
    },
    done: true,
    finishReason: state.finishReason,
    usage: state.anthropicUsage
      ? createTokenUsage({
          inputTokens: anthropicInputTokens,
          outputTokens: state.anthropicUsage.output_tokens,
          cachedInputTokens,
          cacheWriteInputTokens,
        })
      : createTokenUsage({
          inputTokens: state.openAIUsage?.prompt_tokens,
          outputTokens: state.openAIUsage?.completion_tokens,
          totalTokens: state.openAIUsage?.total_tokens,
          cachedInputTokens: state.openAIUsage?.prompt_tokens_details?.cached_tokens,
        }),
  };
}
