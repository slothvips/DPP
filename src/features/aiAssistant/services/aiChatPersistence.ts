import { addMessage } from '@/lib/db/ai';
import { recordRoleUsageForSession } from '@/lib/db/roleUsage';
import { logger } from '@/utils/logger';
import type { ChatMessage } from '../types';

export async function saveUserMessage(sessionId: string | null, message: ChatMessage) {
  if (!sessionId) {
    return;
  }

  try {
    await addMessage({
      sessionId,
      id: message.id,
      role: 'user',
      content: message.content,
      name: message.name,
      toolCallId: message.toolCallId,
      toolCalls: message.toolCalls,
      providerMetadata: message.providerMetadata,
      usage: message.usage,
      createdAt: message.createdAt,
    });
    try {
      await recordRoleUsageForSession(sessionId);
    } catch (error) {
      logger.warn('[AIChat] Failed to record role usage:', error);
    }
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
      id: message.id,
      role: 'assistant',
      content: message.content,
      name: message.name,
      toolCalls: message.toolCalls,
      providerMetadata: message.providerMetadata,
      usage: message.usage,
      createdAt: message.createdAt,
    });
  } catch (error) {
    logger.error('[AIChat] Failed to save assistant message:', error);
  }
}

export async function saveToolMessages(sessionId: string | null, toolMessages: ChatMessage[]) {
  if (!sessionId || toolMessages.length === 0) {
    return;
  }

  const batchCreatedAt = Date.now();
  for (const [index, message] of toolMessages.entries()) {
    try {
      await addMessage({
        sessionId,
        id: message.id,
        role: 'tool',
        content: message.content,
        name: message.name,
        toolCallId: message.toolCallId,
        toolCalls: message.toolCalls,
        providerMetadata: message.providerMetadata,
        usage: message.usage,
        createdAt: message.createdAt ?? batchCreatedAt + index,
      });
    } catch (error) {
      logger.error('[AIChat] Failed to save tool result:', error);
    }
  }
}
