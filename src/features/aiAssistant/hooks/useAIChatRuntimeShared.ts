import type { OpenAIToolDefinition, ChatMessage as ProviderChatMessage } from '@/lib/ai/types';
import type { ChatMessage } from '../types';

export function buildRuntimeRequestMessages(
  systemPrompt: string,
  apiMessages: ProviderChatMessage[]
): ProviderChatMessage[] {
  return [{ role: 'system', content: systemPrompt }, ...apiMessages];
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
