import type { ChatMessage as ProviderChatMessage } from '@/lib/ai/types';
import { logger } from '@/utils/logger';
import type { ChatMessage } from '../types';
import type { AIChatStatus } from './useAIChat.types';

export function generateAIChatActionId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function createUserChatMessage(content: string): ChatMessage {
  return {
    id: generateAIChatActionId(),
    role: 'user',
    content,
    createdAt: Date.now(),
  };
}

export function createStoppedChatMessage(): ChatMessage {
  return {
    id: generateAIChatActionId(),
    role: 'user',
    content: '任务已终止。',
    createdAt: Date.now(),
  };
}

export function buildSendMessagePayload(
  nextMessages: ChatMessage[],
  userMessage: ChatMessage,
  toLibChatMessage: (message: ChatMessage) => ProviderChatMessage
): ProviderChatMessage[] {
  return [...nextMessages.slice(0, -1).map(toLibChatMessage), toLibChatMessage(userMessage)];
}

export function handleAIChatActionError(options: {
  label: string;
  error: unknown;
  setStatus: (status: AIChatStatus) => void;
  setError: (error: string | null) => void;
}) {
  const { label, error, setStatus, setError } = options;

  if (error instanceof Error && error.name === 'AbortError') {
    setStatus('idle');
    return;
  }

  logger.error(label, error);
  setError(error instanceof Error ? error.message : 'Unknown error');
  setStatus('error');
}
