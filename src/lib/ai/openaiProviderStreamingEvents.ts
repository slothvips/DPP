import { logger } from '@/utils/logger';
import {
  type OpenAIStreamingState,
  appendOpenAIStreamingContent,
  appendOpenAIStreamingReasoningContent,
  setOpenAIStreamingFallbackContent,
  upsertOpenAIStreamingToolCall,
} from './openaiProviderStreamingShared';
import {
  getSSEDataPayload,
  mergeStreamedValue,
  resolveStreamingToolCallKey,
} from './providerShared';
import type { OpenAIToolCall } from './types';

interface OpenAIStreamingEventPayload {
  choices?: {
    delta?: {
      content?: string;
      reasoning_content?: string;
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
      reasoning_content?: string;
      tool_calls?: OpenAIToolCall[];
    };
    finish_reason?: string | null;
  }[];
}

export function processOpenAIStreamingEventBlock(options: {
  eventBlock: string;
  state: OpenAIStreamingState;
  onChunk: (chunk: string) => void;
}) {
  const { eventBlock, state, onChunk } = options;

  try {
    const data = getSSEDataPayload(eventBlock);
    if (!data || data === '[DONE]') {
      return;
    }

    const parsed = JSON.parse(data) as OpenAIStreamingEventPayload;
    const choice = parsed.choices?.[0];
    const delta = choice?.delta;

    if (delta?.reasoning_content) {
      appendOpenAIStreamingReasoningContent(state, delta.reasoning_content);
    }

    if (choice?.message?.reasoning_content && !state.reasoningContent) {
      appendOpenAIStreamingReasoningContent(state, choice.message.reasoning_content);
    }

    if (delta?.content) {
      appendOpenAIStreamingContent(state, delta.content, onChunk);
    } else if (choice?.message?.content) {
      setOpenAIStreamingFallbackContent(state, choice.message.content);
    }

    for (const partialToolCall of delta?.tool_calls || []) {
      const key = resolveStreamingToolCallKey(
        partialToolCall,
        state.toolCallLookup,
        state.toolCallKeyByIndex
      );
      upsertOpenAIStreamingToolCall({
        state,
        key,
        partialToolCall,
        mergeValue: mergeStreamedValue,
      });
    }

    if (choice?.message?.tool_calls?.length) {
      choice.message.tool_calls.forEach((toolCall, index) => {
        const key = resolveStreamingToolCallKey(
          { id: toolCall.id, index },
          state.toolCallLookup,
          state.toolCallKeyByIndex
        );
        state.toolCallLookup.set(key, {
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
      state.finishReason = choice.finish_reason;
    }
  } catch (error) {
    logger.debug('Failed to parse SSE data:', error);
  }
}
