import { logger } from '@/utils/logger';
import {
  type AnthropicStreamingState,
  appendAnthropicStreamingContent,
  getLatestAnthropicToolCall,
  setAnthropicStreamingFallbackContent,
  upsertOpenAIStreamingToolCall,
} from './anthropicProviderStreamingShared';
import {
  getSSEDataPayload,
  mergeStreamedValue,
  resolveStreamingToolCallKey,
} from './providerShared';
import type { OpenAIToolCall } from './types';

interface AnthropicStreamingEventPayload {
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
}

export function processAnthropicStreamingEventBlock(options: {
  eventBlock: string;
  state: AnthropicStreamingState;
  onChunk: (chunk: string) => void;
}) {
  const { eventBlock, state, onChunk } = options;
  const data = getSSEDataPayload(eventBlock);
  if (!data || data === '[DONE]') {
    return;
  }

  try {
    const parsed = JSON.parse(data) as AnthropicStreamingEventPayload;

    if (parsed.type === 'content_block_delta') {
      if (parsed.delta?.type === 'text_delta' && parsed.delta.text) {
        appendAnthropicStreamingContent(state, parsed.delta.text, onChunk);
      } else if (parsed.delta?.type === 'thinking_delta' && parsed.delta.thinking) {
        appendAnthropicStreamingContent(state, parsed.delta.thinking, onChunk);
      } else if (parsed.delta?.type === 'input_json_delta' && parsed.delta.partial_json) {
        const lastToolCall = getLatestAnthropicToolCall(state);
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
        state.anthropicToolCallLookup.set(toolCall.id, toolCall);
      }
    } else if (parsed.choices?.[0]?.delta?.content) {
      appendAnthropicStreamingContent(state, parsed.choices[0].delta.content, onChunk);
    } else if (parsed.choices?.[0]?.message?.content) {
      setAnthropicStreamingFallbackContent(state, parsed.choices[0].message.content);
    }

    if (parsed.choices?.[0]?.message?.tool_calls?.length) {
      parsed.choices[0].message.tool_calls.forEach((toolCall, index) => {
        const key = resolveStreamingToolCallKey(
          { id: toolCall.id, index },
          state.openAIToolCallLookup,
          state.openAIToolCallKeyByIndex
        );
        state.openAIToolCallLookup.set(key, {
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
        state.openAIToolCallLookup,
        state.openAIToolCallKeyByIndex
      );
      upsertOpenAIStreamingToolCall({
        state,
        key,
        partialToolCall,
        mergeValue: mergeStreamedValue,
      });
    }

    if (parsed.choices?.[0]?.finish_reason !== undefined) {
      state.finishReason = parsed.choices[0].finish_reason;
    }
  } catch (error) {
    logger.debug('[Anthropic] Failed to parse SSE data:', error);
  }
}
