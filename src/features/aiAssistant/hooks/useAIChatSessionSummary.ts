import { useCallback } from 'react';
import type { ModelProvider } from '@/lib/ai/types';
import { getMessagesBySession, replaceSessionMessages } from '@/lib/db/ai';
import { logger } from '@/utils/logger';
import {
  buildConversationSummaryInput,
  buildConversationSummaryPrompt,
} from '@/features/aiAssistant/lib/sessionCompression';

interface UseAIChatSessionSummaryOptions {
  sessionId: string | null;
  loadSessions: () => Promise<void>;
  getProvider: () => Promise<ModelProvider>;
}

export function useAIChatSessionSummary({
  sessionId,
  loadSessions,
  getProvider,
}: UseAIChatSessionSummaryOptions) {
  return useCallback(async (): Promise<boolean> => {
    if (!sessionId) {
      logger.warn('[AIChat] Cannot compress: no session ID');
      return false;
    }

    try {
      const allMessages = await getMessagesBySession(sessionId);
      if (allMessages.length === 0) {
        logger.warn('[AIChat] Cannot compress: no messages in session');
        return false;
      }

      const provider = await getProvider();
      const response = await provider.chat(
        [
          {
            role: 'system',
            content: '你是 D仔 的会话记忆整理器。你的输出会作为后续对话的唯一历史上下文。',
          },
          {
            role: 'user',
            content: buildConversationSummaryPrompt(buildConversationSummaryInput(allMessages)),
          },
        ],
        { stream: false, temperature: 0.2 }
      );
      const summary = response.message.content.trim();
      if (!summary) {
        throw new Error('D仔未生成有效的会话摘要');
      }

      await replaceSessionMessages(sessionId, [
        {
          sessionId,
          role: 'assistant',
          content: `【会话摘要】\n\n${summary}`,
        },
      ]);
      await loadSessions();

      logger.info('[AIChat] Session compressed successfully', {
        sessionId,
        originalMessageCount: allMessages.length,
      });

      return true;
    } catch (err) {
      logger.error('[AIChat] Failed to compress session:', err);
      return false;
    }
  }, [getProvider, loadSessions, sessionId]);
}
