import { stripThinkingContent } from './ollama';
import { anthropicTools, buildAnthropicOpenAIRequest, mapOpenAIToolCalls } from './providerShared';
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
      input: JSON.parse(toolCall.function.arguments),
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

  const tools = anthropicTools(options);
  if (tools?.length) {
    requestBody.tools = tools;
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
    requestBody.temperature
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
      providerMetadata: buildAnthropicProviderMetadata(response.content),
    },
    done: response.stop_reason === 'end_turn' || response.stop_reason === 'stop_sequence',
    finishReason: response.stop_reason,
  };
}
