import { addMessage } from '@/lib/db/ai';
import { logger } from '@/utils/logger';
import type { ChatMessage } from '../types';

export async function saveUserMessage(sessionId: string | null, message: ChatMessage) {
  if (!sessionId) {
    return;
  }

  try {
    await addMessage({
      sessionId,
      role: 'user',
      content: message.content,
    });
  } catch (error) {
    logger.error('[AIChat] Failed to save user message:', error);
  }
}

export async function saveAssistantMessage(sessionId: string | null, message: ChatMessage) {
  if (!sessionId) {
    return;
  }

  try {
    await addMessage({
      sessionId,
      role: 'assistant',
      content: message.content,
      name: message.name,
      toolCalls: message.toolCalls,
      providerMetadata: message.providerMetadata,
    });
  } catch (error) {
    logger.error('[AIChat] Failed to save assistant message:', error);
  }
}

export async function saveToolMessages(sessionId: string | null, toolMessages: ChatMessage[]) {
  if (!sessionId || toolMessages.length === 0) {
    return;
  }

  await Promise.all(
    toolMessages.map(async (message) => {
      try {
        await addMessage({
          sessionId,
          role: 'tool',
          content: message.content,
          name: message.name,
          toolCallId: message.toolCallId,
        });
      } catch (error) {
        logger.error('[AIChat] Failed to save tool result:', error);
      }
    })
  );
}
