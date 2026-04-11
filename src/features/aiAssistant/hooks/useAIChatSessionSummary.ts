import { useCallback } from 'react';
import { addMessage, createSession, getMessagesBySession, getSession } from '@/lib/db/ai';
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
  return useCallback(async (): Promise<string | null> => {
    if (!sessionId) {
      logger.warn('[AIChat] Cannot compress: no session ID');
      return null;
    }

    const allMessages = await getMessagesBySession(sessionId);
    if (allMessages.length === 0) {
      logger.warn('[AIChat] Cannot compress: no messages in session');
      return null;
    }

    const compressedMessages = buildCompressedConversationText(allMessages);
    const toolCallCount = countToolMessages(allMessages);

    try {
      const currentSession = await getSession(sessionId);
      const oldTitle = currentSession?.title || '会话';

      const newSession = await createSession(`${oldTitle}(已压缩)`);

      await addMessage({
        sessionId: newSession.id,
        role: 'assistant',
        content: buildCompressionSummaryMessage(compressedMessages, toolCallCount),
      });

      if (compressedMessages.length <= 4000) {
        await addMessage({
          sessionId: newSession.id,
          role: 'assistant',
          content: buildCompressedConversationArchive(compressedMessages),
        });
      }

      await loadSessions();

      logger.info('[AIChat] Session compressed successfully', {
        oldSessionId: sessionId,
        newSessionId: newSession.id,
        originalMessageCount: allMessages.length,
        toolCallCount,
      });

      return newSession.id;
    } catch (err) {
      logger.error('[AIChat] Failed to compress session:', err);
      return null;
    }
  }, [loadSessions, sessionId]);
}
