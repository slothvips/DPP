import type { ChatMessage } from '@/features/aiAssistant/types';
import type { ChatMessage as ProviderChatMessage } from '@/lib/ai/types';

export function buildSendMessagePayload(
  nextMessages: ChatMessage[],
  userMessage: ChatMessage,
  toLibChatMessage: (message: ChatMessage) => ProviderChatMessage,
  excludedMessageIds: ReadonlySet<string> = new Set([userMessage.id])
): ProviderChatMessage[] {
  return [
    ...nextMessages.filter((message) => !excludedMessageIds.has(message.id)).map(toLibChatMessage),
    toLibChatMessage(userMessage),
  ];
}
