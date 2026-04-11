import { stripThinkingContent } from './ollama';
import { normalizeToolArgumentsJson } from './providerShared';
import type { ChatResponse, OpenAIToolCall } from './types';

interface PartialStreamingToolCall {
  id?: string;
  function?: {
    name?: string;
    arguments?: string;
  };
}

export interface AnthropicStreamingState {
  fullContent: string;
  finishReason: string | null;
  anthropicToolCallLookup: Map<string, OpenAIToolCall>;
  openAIToolCallLookup: Map<string, OpenAIToolCall>;
  openAIToolCallKeyByIndex: Map<number, string>;
}

export function createAnthropicStreamingState(): AnthropicStreamingState {
  return {
    fullContent: '',
    finishReason: null,
    anthropicToolCallLookup: new Map<string, OpenAIToolCall>(),
    openAIToolCallLookup: new Map<string, OpenAIToolCall>(),
    openAIToolCallKeyByIndex: new Map<number, string>(),
  };
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

export function buildAnthropicStreamingResponse(state: AnthropicStreamingState): ChatResponse {
  const anthropicToolCalls = Array.from(state.anthropicToolCallLookup.values()).map((toolCall) => ({
    ...toolCall,
    function: {
      ...toolCall.function,
      arguments: normalizeToolArgumentsJson(toolCall.function.arguments),
    },
  }));

  const openAIToolCalls = Array.from(state.openAIToolCallLookup.values()).map((toolCall) => ({
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
      content: stripThinkingContent(state.fullContent),
      toolCalls: finalToolCalls.length ? finalToolCalls : undefined,
    },
    done: true,
    finishReason: state.finishReason,
  };
}
