import { describeOpenAIResponseBody } from './openAIResponseGuards';
import {
  anthropicTools,
  buildAnthropicOpenAIRequest,
  mapOpenAIToolCalls,
  normalizeToolArgumentsJsonForRequest,
} from './providerShared';
import { stripThinkingContent } from './stripThinking';
import { createTokenUsage } from './tokenUsage';
import type {
  AnthropicChatMessage,
  AnthropicChatRequest,
  AnthropicChatResponse,
  AnthropicMessageContentBlock,
  AnthropicResponseContentBlock,
  ChatMessage,
  ChatOptions,
  ChatResponse,
  OpenAIChatResponse,
} from './types';

export function getAnthropicHeaders(apiKey: string): HeadersInit {
  return {
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    'Content-Type': 'application/json',
  };
}

export function getOpenAIHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
}

function toAnthropicAssistantContentBlocks(message: ChatMessage): AnthropicMessageContentBlock[] {
  const rawBlocks = message.providerMetadata?.anthropicContentBlocks;
  if (Array.isArray(rawBlocks) && rawBlocks.length > 0) {
    return rawBlocks as AnthropicMessageContentBlock[];
  }

  const content: AnthropicMessageContentBlock[] = [];
  if (message.content) {
    content.push({ type: 'text', text: message.content });
  }

  for (const toolCall of message.toolCalls || []) {
    content.push({
      type: 'tool_use',
      id: toolCall.id,
      name: toolCall.function.name,
      input: JSON.parse(normalizeToolArgumentsJsonForRequest(toolCall.function.arguments)),
    });
  }

  return content;
}

export function toAnthropicMessage(message: ChatMessage): AnthropicChatMessage {
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

  if (message.role === 'assistant') {
    const content = toAnthropicAssistantContentBlocks(message);
    return {
      role: 'assistant',
      content: content.length > 0 ? content : [{ type: 'text', text: message.content }],
    };
  }

  if (message.images?.length) {
    return {
      role: 'user',
      content: [
        { type: 'text', text: message.content },
        ...message.images.map((image) => ({
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: image.mediaType,
            data: image.data,
          },
        })),
      ],
    };
  }

  return {
    role: message.role,
    content: message.content,
  };
}

export function buildAnthropicChatRequest(
  model: string,
  messages: ChatMessage[],
  options?: ChatOptions
): { requestBody: AnthropicChatRequest; systemContent: string } {
  const systemMessages = messages.filter((message) => message.role === 'system');
  const otherMessages = messages.filter((message) => message.role !== 'system');
  const systemContent = systemMessages.map((message) => message.content).join('\n');
  const legacyToolResultIds = new Set<string>();

  const anthropicMessages = otherMessages.flatMap((message) => {
    if (
      message.role === 'assistant' &&
      message.toolCalls?.length &&
      !message.providerMetadata?.anthropicContentBlocks
    ) {
      message.toolCalls.forEach((toolCall) => legacyToolResultIds.add(toolCall.id));
      return [
        {
          role: 'assistant' as const,
          content: [{ type: 'text' as const, text: message.content || '历史工具调用记录' }],
        },
      ];
    }

    if (
      message.role === 'tool' &&
      message.toolCallId &&
      legacyToolResultIds.has(message.toolCallId)
    ) {
      return [
        {
          role: 'user' as const,
          content: `工具执行结果：${message.content}`,
        },
      ];
    }

    return [toAnthropicMessage(message)];
  });

  const requestBody: AnthropicChatRequest = {
    model,
    messages: anthropicMessages,
    max_tokens: 4096,
    stream: options?.stream ?? false,
  };

  if (systemContent) {
    requestBody.system = systemContent;
  }

  if (options?.temperature !== undefined) {
    requestBody.temperature = options.temperature;
  }

  if (options?.providerOptions?.thinking) {
    requestBody.thinking = options.providerOptions.thinking;
  }

  const tools = anthropicTools(options);
  if (tools?.length) {
    requestBody.tools = tools;
    const toolChoice = options?.toolChoice;
    if (toolChoice && typeof toolChoice === 'object') {
      requestBody.tool_choice = { type: 'tool', name: toolChoice.function.name };
    } else if (toolChoice === 'required') {
      requestBody.tool_choice = { type: 'any' };
    } else if (toolChoice) {
      requestBody.tool_choice = { type: toolChoice };
    }
  }

  return { requestBody, systemContent };
}

export function buildAnthropicOpenAIRequestBody(
  model: string,
  requestBody: AnthropicChatRequest
): ReturnType<typeof buildAnthropicOpenAIRequest> {
  return buildAnthropicOpenAIRequest(
    model,
    requestBody.messages,
    requestBody.system || '',
    requestBody.tools,
    requestBody.temperature,
    requestBody.tool_choice
  );
}

function buildAnthropicProviderMetadata(content: AnthropicResponseContentBlock[]) {
  return {
    anthropicContentBlocks: content,
  };
}

export function mapAnthropicResponse(
  response: AnthropicChatResponse | OpenAIChatResponse
): ChatResponse {
  if ('choices' in response) {
    const choice = response.choices?.[0];
    if (!choice?.message) {
      throw new Error(`OpenAI 响应缺少 choices：${describeOpenAIResponseBody(response)}`);
    }
    return {
      message: {
        role: 'assistant',
        content: stripThinkingContent(choice.message?.content || ''),
        toolCalls: mapOpenAIToolCalls(choice.message.tool_calls),
        providerMetadata: choice.message.reasoning_content
          ? { openAIReasoningContent: choice.message.reasoning_content }
          : undefined,
      },
      done: choice.finish_reason === 'stop' || choice.finish_reason === 'tool_calls',
      finishReason: choice.finish_reason,
      usage: createTokenUsage({
        inputTokens: response.usage?.prompt_tokens,
        outputTokens: response.usage?.completion_tokens,
        totalTokens: response.usage?.total_tokens,
        cachedInputTokens: response.usage?.prompt_tokens_details?.cached_tokens,
      }),
    };
  }

  if (!Array.isArray(response.content)) {
    throw new Error(`Anthropic 响应缺少 content：${describeOpenAIResponseBody(response)}`);
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

  const cachedInputTokens = response.usage.cache_read_input_tokens;
  const cacheWriteInputTokens = response.usage.cache_creation_input_tokens;
  const inputTokens =
    response.usage.input_tokens + (cachedInputTokens ?? 0) + (cacheWriteInputTokens ?? 0);

  return {
    message: {
      role: 'assistant',
      content: stripThinkingContent(textContent),
      toolCalls: toolCalls.length ? toolCalls : undefined,
      providerMetadata: buildAnthropicProviderMetadata(response.content),
    },
    done: response.stop_reason === 'end_turn' || response.stop_reason === 'stop_sequence',
    finishReason: response.stop_reason,
    usage: createTokenUsage({
      inputTokens,
      outputTokens: response.usage.output_tokens,
      cachedInputTokens,
      cacheWriteInputTokens,
    }),
  };
}
