import { logger } from '@/utils/logger';
import {
  type AnthropicStreamingState,
  appendAnthropicResponseContentBlock,
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
  delta?: {
    type?: string;
    text?: string;
    thinking?: string;
    partial_json?: string;
    signature?: string;
  };
  content_block?: {
    type?: string;
    id?: string;
    name?: string;
    text?: string;
    thinking?: string;
    data?: string;
    signature?: string;
  };
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
        const lastBlock = state.responseContentBlocks.at(-1);
        if (lastBlock?.type === 'text') {
          lastBlock.text += parsed.delta.text;
        }
      } else if (parsed.delta?.type === 'thinking_delta' && parsed.delta.thinking) {
        appendAnthropicStreamingContent(state, parsed.delta.thinking, onChunk);
        if (state.currentThinkingBlock) {
          state.currentThinkingBlock.thinking += parsed.delta.thinking;
        }
      } else if (parsed.delta?.type === 'signature_delta' && parsed.delta.signature) {
        if (state.currentThinkingBlock) {
          state.currentThinkingBlock.signature =
            (state.currentThinkingBlock.signature || '') + parsed.delta.signature;
        }
      } else if (parsed.delta?.type === 'input_json_delta' && parsed.delta.partial_json) {
        const lastToolCall = getLatestAnthropicToolCall(state);
        if (lastToolCall) {
          lastToolCall.function.arguments += parsed.delta.partial_json;
        }
        if (state.currentToolUseBlock) {
          state.currentToolUseJsonBuffer += parsed.delta.partial_json;
          try {
            state.currentToolUseBlock.input = JSON.parse(state.currentToolUseJsonBuffer);
          } catch {
            // wait for complete JSON
          }
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
        state.currentToolUseJsonBuffer = '';
        state.currentToolUseBlock = {
          type: 'tool_use',
          id: toolCall.id,
          name: toolCall.function.name,
          input: {},
        };
        appendAnthropicResponseContentBlock(state, state.currentToolUseBlock);
      } else if (parsed.content_block?.type === 'text') {
        appendAnthropicResponseContentBlock(state, {
          type: 'text',
          text: parsed.content_block.text || '',
        });
      } else if (parsed.content_block?.type === 'thinking') {
        state.currentThinkingBlock = {
          type: 'thinking',
          thinking: parsed.content_block.thinking || '',
          signature: parsed.content_block.signature,
        };
        appendAnthropicResponseContentBlock(state, state.currentThinkingBlock);
      } else if (parsed.content_block?.type === 'redacted_thinking') {
        appendAnthropicResponseContentBlock(state, {
          type: 'redacted_thinking',
          data: parsed.content_block.data || '',
        });
      }
    } else if (parsed.type === 'content_block_stop') {
      state.currentThinkingBlock = null;
      state.currentToolUseBlock = null;
      state.currentToolUseJsonBuffer = '';
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
