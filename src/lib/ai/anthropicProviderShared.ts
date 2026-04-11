import { stripThinkingContent } from './ollama';
import { anthropicTools, buildAnthropicOpenAIRequest, mapOpenAIToolCalls } from './providerShared';
import type {
  AnthropicChatMessage,
  AnthropicChatRequest,
  AnthropicChatResponse,
  AnthropicMessageContentBlock,
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

export function buildAnthropicChatRequest(
  model: string,
  messages: ChatMessage[],
  options?: ChatOptions
): { requestBody: AnthropicChatRequest; systemContent: string } {
  const systemMessages = messages.filter((message) => message.role === 'system');
  const otherMessages = messages.filter((message) => message.role !== 'system');
  const systemContent = systemMessages.map((message) => message.content).join('\n');

  const requestBody: AnthropicChatRequest = {
    model,
    messages: otherMessages.map(toAnthropicMessage),
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
    },
    done: response.stop_reason === 'end_turn' || response.stop_reason === 'stop_sequence',
    finishReason: response.stop_reason,
  };
}
