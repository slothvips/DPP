import type {
  AnthropicChatMessage,
  AnthropicMessageContentBlock,
  AnthropicToolDefinition,
  OpenAIChatMessage,
  OpenAIChatRequest,
} from './types';

export function anthropicToolDefinitionsToOpenAI(
  tools?: AnthropicToolDefinition[]
): OpenAIChatRequest['tools'] | undefined {
  if (!tools?.length) {
    return undefined;
  }

  return tools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
    },
  }));
}

export function anthropicMessageToOpenAIMessage(message: AnthropicChatMessage): OpenAIChatMessage {
  if (typeof message.content === 'string') {
    return {
      role: message.role,
      content: message.content,
    };
  }

  const textContent = message.content
    .filter(
      (block): block is Extract<AnthropicMessageContentBlock, { type: 'text' }> =>
        block.type === 'text'
    )
    .map((block) => block.text)
    .join('');

  const openAIMessage: OpenAIChatMessage = {
    role: message.role,
    content: textContent,
  };

  const toolResultBlock = message.content.find(
    (block): block is Extract<AnthropicMessageContentBlock, { type: 'tool_result' }> =>
      block.type === 'tool_result'
  );
  if (toolResultBlock) {
    openAIMessage.role = 'tool';
    openAIMessage.content = toolResultBlock.content;
    openAIMessage.tool_call_id = toolResultBlock.tool_use_id;
    return openAIMessage;
  }

  const toolUseBlocks = message.content.filter(
    (block): block is Extract<AnthropicMessageContentBlock, { type: 'tool_use' }> =>
      block.type === 'tool_use'
  );
  if (toolUseBlocks.length) {
    openAIMessage.tool_calls = toolUseBlocks.map((block) => ({
      id: block.id,
      type: 'function',
      function: {
        name: block.name,
        arguments: JSON.stringify(block.input),
      },
    }));
  }

  return openAIMessage;
}

export function anthropicMessagesToOpenAIMessages(
  messages: AnthropicChatMessage[]
): OpenAIChatMessage[] {
  return messages.map(anthropicMessageToOpenAIMessage);
}
