import { useCallback } from 'react';
import type { ChatMessage as ProviderChatMessage } from '@/lib/ai/types';
import {
  saveAssistantMessage as persistAssistantMessage,
  saveToolMessages as persistToolMessages,
  saveUserMessage as persistUserMessage,
} from '../services/aiChatPersistence';
import type { ChatMessage } from '../types';

export function toProviderChatMessage(message: ChatMessage): ProviderChatMessage {
  return {
    role: message.role,
    content: message.content,
    name: message.name,
    toolCallId: message.toolCallId,
    toolCalls: message.toolCalls,
    providerMetadata: message.providerMetadata,
  };
}

export function useAIChatPersistence(sessionId: string | null) {
  const saveUserMessage = useCallback(
    async (message: ChatMessage) => persistUserMessage(sessionId, message),
    [sessionId]
  );

  const saveAssistantMessage = useCallback(
    async (message: ChatMessage) => persistAssistantMessage(sessionId, message),
    [sessionId]
  );

  const saveToolMessages = useCallback(
    async (messages: ChatMessage[]) => persistToolMessages(sessionId, messages),
    [sessionId]
  );

  return {
    saveUserMessage,
    saveAssistantMessage,
    saveToolMessages,
  };
}
