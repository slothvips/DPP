import type {
  AnthropicToolDefinition,
  ChatOptions,
  OpenAIChatRequest,
  OpenAIToolCall,
} from './types';

export function mapOpenAIToolCalls(toolCalls?: OpenAIToolCall[]): OpenAIToolCall[] | undefined {
  if (!toolCalls?.length) {
    return undefined;
  }

  return toolCalls.map((toolCall) => ({
    id: toolCall.id,
    type: 'function',
    function: {
      name: toolCall.function.name,
      arguments: toolCall.function.arguments,
    },
  }));
}

export function openAIToolChoice(
  toolChoice: ChatOptions['toolChoice'] | undefined
): OpenAIChatRequest['tool_choice'] | undefined {
  return toolChoice;
}

export function anthropicTools(options?: ChatOptions): AnthropicToolDefinition[] | undefined {
  if (!options?.tools?.length) {
    return undefined;
  }

  return options.tools.map((tool) => ({
    name: tool.function.name,
    description: tool.function.description,
    input_schema: tool.function.parameters,
  }));
}
