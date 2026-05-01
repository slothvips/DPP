import type {
  OpenAIToolCall,
  OpenAIToolDefinition,
  ChatMessage as ProviderChatMessage,
} from '@/lib/ai/types';
import type { ChatMessage } from '../types';

function collectFollowingToolMessages(
  messages: ProviderChatMessage[],
  startIndex: number
): ProviderChatMessage[] {
  const toolMessages: ProviderChatMessage[] = [];

  for (let index = startIndex; index < messages.length; index += 1) {
    const message = messages[index];
    if (message.role !== 'tool') {
      break;
    }
    toolMessages.push(message);
  }

  return toolMessages;
}

function normalizeToolCallBlock(
  message: ProviderChatMessage,
  toolMessages: ProviderChatMessage[]
): ProviderChatMessage[] {
  const toolCallIds = new Set(toolMessages.map((toolMessage) => toolMessage.toolCallId));
  const toolCalls = (message.toolCalls || []).filter((toolCall: OpenAIToolCall) =>
    toolCallIds.has(toolCall.id)
  );

  if (toolCalls.length === 0) {
    return message.content || message.providerMetadata
      ? [{ ...message, toolCalls: undefined }]
      : [];
  }

  const keptToolCallIds = new Set(toolCalls.map((toolCall) => toolCall.id));
  return [
    { ...message, toolCalls },
    ...toolMessages.filter((toolMessage) =>
      toolMessage.toolCallId ? keptToolCallIds.has(toolMessage.toolCallId) : false
    ),
  ];
}

function normalizeToolMessageHistory(messages: ProviderChatMessage[]): ProviderChatMessage[] {
  const normalizedMessages: ProviderChatMessage[] = [];

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (message.role === 'tool') {
      continue;
    }

    if (message.role !== 'assistant' || !message.toolCalls?.length) {
      normalizedMessages.push(message);
      continue;
    }

    const toolMessages = collectFollowingToolMessages(messages, index + 1);
    normalizedMessages.push(...normalizeToolCallBlock(message, toolMessages));
    index += toolMessages.length;
  }

  return normalizedMessages;
}

export function buildRuntimeRequestMessages(
  systemPrompt: string,
  apiMessages: ProviderChatMessage[]
): ProviderChatMessage[] {
  return [{ role: 'system', content: systemPrompt }, ...normalizeToolMessageHistory(apiMessages)];
}

export function resolveRuntimeToolChoice(tools: OpenAIToolDefinition[]): 'auto' | 'none' {
  return tools.length ? 'auto' : 'none';
}

export function createAssistantRuntimeMessage(
  content: string,
  toolCalls?: ChatMessage['toolCalls'],
  providerMetadata?: ChatMessage['providerMetadata']
): ChatMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    role: 'assistant',
    content,
    toolCalls,
    providerMetadata,
    createdAt: Date.now(),
  };
}
