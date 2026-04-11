import {
  anthropicMessagesToOpenAIMessages,
  anthropicToolDefinitionsToOpenAI,
} from './providerAnthropicOpenAIMessages';
import type { AnthropicChatMessage, AnthropicToolDefinition, OpenAIChatRequest } from './types';

export function buildAnthropicOpenAIRequest(
  model: string,
  messages: AnthropicChatMessage[],
  systemContent: string,
  tools?: AnthropicToolDefinition[],
  temperature?: number
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
    request.tool_choice = 'auto';
  }

  return request;
}
