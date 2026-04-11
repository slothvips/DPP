import { stripThinkingContent } from './ollama';
import { mapOpenAIToolCalls, openAIToolChoice } from './providerShared';
import type {
  ChatMessage,
  ChatOptions,
  ChatResponse,
  OpenAIChatMessage,
  OpenAIChatRequest,
  OpenAIChatResponse,
} from './types';

export function getOpenAIHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
}

export function toOpenAIMessage(message: ChatMessage): OpenAIChatMessage {
  return {
    role: message.role,
    content: message.content,
    name: message.name,
    tool_call_id: message.toolCallId,
    tool_calls: mapOpenAIToolCalls(message.toolCalls),
  };
}

export function buildOpenAIChatRequest(
  model: string,
  messages: ChatMessage[],
  options?: ChatOptions
): OpenAIChatRequest {
  const requestBody: OpenAIChatRequest = {
    model,
    messages: messages.map(toOpenAIMessage),
    stream: options?.stream ?? false,
  };

  if (options?.temperature !== undefined) {
    requestBody.temperature = options.temperature;
  }

  if (options?.tools?.length) {
    requestBody.tools = options.tools;
    requestBody.tool_choice = openAIToolChoice(options.toolChoice) || 'auto';
  }

  return requestBody;
}

export function mapOpenAIResponse(response: OpenAIChatResponse): ChatResponse {
  const choice = response.choices[0];
  return {
    message: {
      role: choice.message.role,
      content: stripThinkingContent(choice.message.content || ''),
      toolCalls: mapOpenAIToolCalls(choice.message.tool_calls),
    },
    done: choice.finish_reason === 'stop' || choice.finish_reason === 'tool_calls',
    finishReason: choice.finish_reason,
  };
}
