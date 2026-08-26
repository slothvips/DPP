import { useCallback } from 'react';
import { getMessagesBySession, replaceSessionMessages } from '@/lib/db/ai';
import { logger } from '@/utils/logger';
import {
  buildCompressedConversationArchive,
  buildCompressedConversationText,
  buildCompressionSummaryMessage,
  countToolMessages,
} from '../lib/sessionCompression';

interface UseAIChatSessionSummaryOptions {
  sessionId: string | null;
  loadSessions: () => Promise<void>;
}

export function useAIChatSessionSummary({
  sessionId,
  loadSessions,
}: UseAIChatSessionSummaryOptions) {
  return useCallback(async (): Promise<boolean> => {
    if (!sessionId) {
      logger.warn('[AIChat] Cannot compress: no session ID');
      return false;
    }

    const allMessages = await getMessagesBySession(sessionId);
    if (allMessages.length === 0) {
      logger.warn('[AIChat] Cannot compress: no messages in session');
      return false;
    }

    const compressedMessages = buildCompressedConversationText(allMessages);
    const toolCallCount = countToolMessages(allMessages);

    try {
      const compressedSessionMessages = [
        {
          sessionId,
          role: 'assistant' as const,
          content: buildCompressionSummaryMessage(compressedMessages, toolCallCount),
        },
      ];

      if (compressedMessages.length <= 4000) {
        compressedSessionMessages.push({
          sessionId,
          role: 'assistant',
          content: buildCompressedConversationArchive(compressedMessages),
        });
      }

      await replaceSessionMessages(sessionId, compressedSessionMessages);
      await loadSessions();

      logger.info('[AIChat] Session compressed successfully', {
        sessionId,
        originalMessageCount: allMessages.length,
        toolCallCount,
      });

      return true;
    } catch (err) {
      logger.error('[AIChat] Failed to compress session:', err);
      return false;
    }
  }, [loadSessions, sessionId]);
}
