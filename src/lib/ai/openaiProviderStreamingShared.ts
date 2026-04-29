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

export interface OpenAIStreamingState {
  fullContent: string;
  reasoningContent: string;
  finishReason: string | null;
  toolCallLookup: Map<string, OpenAIToolCall>;
  toolCallKeyByIndex: Map<number, string>;
}

export function createOpenAIStreamingState(): OpenAIStreamingState {
  return {
    fullContent: '',
    reasoningContent: '',
    finishReason: null,
    toolCallLookup: new Map<string, OpenAIToolCall>(),
    toolCallKeyByIndex: new Map<number, string>(),
  };
}

export function appendOpenAIStreamingContent(
  state: OpenAIStreamingState,
  chunk: string,
  onChunk: (chunk: string) => void
) {
  state.fullContent += chunk;
  onChunk(chunk);
}

export function appendOpenAIStreamingReasoningContent(state: OpenAIStreamingState, chunk: string) {
  state.reasoningContent += chunk;
}

export function setOpenAIStreamingFallbackContent(
  state: OpenAIStreamingState,
  content: string | null | undefined
) {
  if (content && !state.fullContent) {
    state.fullContent = content;
  }
}

export function upsertOpenAIStreamingToolCall(options: {
  state: OpenAIStreamingState;
  key: string;
  partialToolCall: PartialStreamingToolCall;
  mergeValue: (currentValue: string, incomingValue: string) => string;
}) {
  const { state, key, partialToolCall, mergeValue } = options;

  const existing = state.toolCallLookup.get(key) || {
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

  state.toolCallLookup.set(key, existing);
}

export function buildOpenAIStreamingResponse(state: OpenAIStreamingState): ChatResponse {
  const finalToolCalls = Array.from(state.toolCallLookup.values()).map((toolCall) => ({
    ...toolCall,
    function: {
      ...toolCall.function,
      arguments: normalizeToolArgumentsJson(toolCall.function.arguments),
    },
  }));

  return {
    message: {
      role: 'assistant',
      content: stripThinkingContent(state.fullContent),
      toolCalls: finalToolCalls.length ? finalToolCalls : undefined,
      providerMetadata: state.reasoningContent
        ? { openAIReasoningContent: state.reasoningContent }
        : undefined,
    },
    done: true,
    finishReason: state.finishReason,
  };
}
