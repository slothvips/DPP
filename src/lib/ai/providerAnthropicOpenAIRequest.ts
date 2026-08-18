import {
  anthropicMessagesToOpenAIMessages,
  anthropicToolDefinitionsToOpenAI,
} from './providerAnthropicOpenAIMessages';
import type {
  AnthropicChatMessage,
  AnthropicChatRequest,
  AnthropicToolDefinition,
  OpenAIChatRequest,
  OpenAIToolChoice,
} from './types';

function toOpenAIToolChoice(
  toolChoice?: AnthropicChatRequest['tool_choice']
): OpenAIToolChoice | undefined {
  if (!toolChoice) {
    return undefined;
  }
  if (toolChoice.type === 'tool') {
    return { type: 'function', function: { name: toolChoice.name } };
  }
  if (toolChoice.type === 'any') {
    return 'required';
  }
  return toolChoice.type;
}

export function buildAnthropicOpenAIRequest(
  model: string,
  messages: AnthropicChatMessage[],
  systemContent: string,
  tools?: AnthropicToolDefinition[],
  temperature?: number,
  toolChoice?: AnthropicChatRequest['tool_choice']
): OpenAIChatRequest {
  const request: OpenAIChatRequest = {
    model,
    messages: [],
  };

  if (systemContent) {
    request.messages.push({ role: 'system', content: systemContent });
  }

  request.messages.push(...anthropicMessagesToOpenAIMessages(messages));

  if (temperature !== undefined) {
    request.temperature = temperature;
  }

  const openAITools = anthropicToolDefinitionsToOpenAI(tools);
  if (openAITools?.length) {
    request.tools = openAITools;
    request.tool_choice = toOpenAIToolChoice(toolChoice) || 'auto';
  }

  return request;
}
