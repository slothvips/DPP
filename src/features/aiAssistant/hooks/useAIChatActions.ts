import { useCallback, useEffect, useRef } from 'react';
import { stopActiveBrowserTask } from '@/lib/ai/tools/browserTask';
import type { ChatMessage as ProviderChatMessage } from '@/lib/ai/types';
import { updateSessionTitle } from '@/lib/db/ai';
import { logger } from '@/utils/logger';
import type { ChatMessage } from '../types';
import type { AIChatStatus } from './useAIChat.types';
import {
  createStoppedChatMessage,
  createUserChatMessage,
  handleAIChatActionError,
} from './useAIChatActions.shared';
import { buildSendMessagePayload } from './useAIChatQueue';

interface QueuedChatMessage {
  message: ChatMessage;
  persisted: Promise<void>;
}

interface UseAIChatActionsOptions {
  sessionId: string | null;
  status: AIChatStatus;
  isFirstMessageRef: React.MutableRefObject<boolean>;
  appendMessages: (messages: ChatMessage[]) => ChatMessage[];
  messagesRef: React.MutableRefObject<ChatMessage[]>;
  setMessagesWithRef: (updater: (prev: ChatMessage[]) => ChatMessage[]) => void;
  saveUserMessage: (message: ChatMessage) => Promise<void>;
  loadSessions: () => Promise<void>;
  runChatCompletion: (apiMessages: ProviderChatMessage[]) => Promise<ChatMessage | null>;
  generateSessionTitle: (userMessage: string) => Promise<string>;
  processAssistantResponse: (assistantMessage: ChatMessage) => Promise<void>;
  toLibChatMessage: (message: ChatMessage) => ProviderChatMessage;
  resetRuntimeState: () => void;
  stopRuntime: (sessionId?: string | null, stopBrowserTask?: boolean) => void;
  cancelPendingToolFlow: (appendCancellationMessages?: boolean) => void;
  resetToolFlowState: () => void;
  clearPersistedMessages: (sessionId: string) => Promise<void>;
  truncatePersistedMessages: (sessionId: string, messageId: string) => Promise<void>;
  setStatus: (status: AIChatStatus) => void;
  setError: (error: string | null) => void;
  getSessionStatus: (sessionId: string) => AIChatStatus;
}

interface UseAIChatActionsReturn {
  sendMessage: (content: string) => Promise<void>;
  continueConversation: (allMessages: ChatMessage[]) => Promise<void>;
  stop: () => void;
  clearMessages: () => Promise<void>;
  editMessage: (messageId: string, content: string) => Promise<void>;
}

export function useAIChatActions({
  sessionId,
  status,
  isFirstMessageRef,
  appendMessages,
  messagesRef,
  setMessagesWithRef,
  saveUserMessage,
  loadSessions,
  runChatCompletion,
  generateSessionTitle,
  processAssistantResponse,
  toLibChatMessage,
  resetRuntimeState,
  stopRuntime,
  cancelPendingToolFlow,
  resetToolFlowState,
  clearPersistedMessages,
  truncatePersistedMessages,
  setStatus,
  setError,
  getSessionStatus,
}: UseAIChatActionsOptions): UseAIChatActionsReturn {
  const queuedMessagesBySessionRef = useRef(new Map<string, QueuedChatMessage[]>());
  const processingSessionsRef = useRef(new Set<string>());
  const getQueuedMessages = useCallback((id: string | null): QueuedChatMessage[] => {
    if (!id) return [];
    const existing = queuedMessagesBySessionRef.current.get(id);
    if (existing) return existing;
    const queue: QueuedChatMessage[] = [];
    queuedMessagesBySessionRef.current.set(id, queue);
    return queue;
  }, []);

  useEffect(() => {
    const queuedMessagesBySession = queuedMessagesBySessionRef.current;
    const processingSessions = processingSessionsRef.current;
    return () => {
      queuedMessagesBySession.clear();
      processingSessions.clear();
    };
  }, []);
  const handleChatError = useCallback(
    (label: string, error: unknown) => {
      handleAIChatActionError({
        label,
        error,
        setStatus,
        setError,
      });
    },
    [setError, setStatus]
  );

  const drainQueuedMessages = useCallback(async () => {
    if (!sessionId || processingSessionsRef.current.has(sessionId)) return;
    const currentStatus = getSessionStatus(sessionId);
    if (
      currentStatus === 'loading' ||
      currentStatus === 'streaming' ||
      currentStatus === 'confirming'
    ) {
      return;
    }

    processingSessionsRef.current.add(sessionId);
    const queue = getQueuedMessages(sessionId);
    try {
      while (queue.length > 0) {
        const queued = queue.shift();
        if (!queued) continue;
        await queued.persisted;
        resetToolFlowState();
        setStatus('loading');
        setError(null);

        try {
          const excludedMessageIds = new Set([
            queued.message.id,
            ...queue.map(({ message }) => message.id),
          ]);
          const assistantMessage = await runChatCompletion(
            buildSendMessagePayload(
              messagesRef.current,
              queued.message,
              toLibChatMessage,
              excludedMessageIds
            )
          );
          if (assistantMessage) await processAssistantResponse(assistantMessage);
        } catch (error) {
          handleChatError('[AIChat] Chat error:', error);
        }

        if (isFirstMessageRef.current) {
          isFirstMessageRef.current = false;
          try {
            const title = await generateSessionTitle(queued.message.content);
            await updateSessionTitle(sessionId, title);
            await loadSessions();
          } catch (error) {
            logger.warn('[AIChat] Failed to generate session title:', error);
          }
        }

        if (getSessionStatus(sessionId) !== 'idle') return;
      }
    } finally {
      processingSessionsRef.current.delete(sessionId);
    }
  }, [
    generateSessionTitle,
    getQueuedMessages,
    getSessionStatus,
    handleChatError,
    isFirstMessageRef,
    loadSessions,
    messagesRef,
    processAssistantResponse,
    resetToolFlowState,
    runChatCompletion,
    sessionId,
    setError,
    setStatus,
    toLibChatMessage,
  ]);

  const continueConversation = useCallback(
    async (allMessages: ChatMessage[]) => {
      resetRuntimeState();

      try {
        const assistantMessage = await runChatCompletion(allMessages.map(toLibChatMessage));
        if (assistantMessage) {
          await processAssistantResponse(assistantMessage);
          await drainQueuedMessages();
        }
      } catch (error) {
        handleChatError('[AIChat] Continue conversation error:', error);
      }
    },
    [
      drainQueuedMessages,
      handleChatError,
      processAssistantResponse,
      resetRuntimeState,
      runChatCompletion,
      toLibChatMessage,
    ]
  );

  useEffect(() => {
    if (status === 'idle') void drainQueuedMessages();
  }, [drainQueuedMessages, status]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!sessionId) return;
      const userMessage = createUserChatMessage(content);
      appendMessages([userMessage]);
      const persisted = saveUserMessage(userMessage);
      getQueuedMessages(sessionId).push({ message: userMessage, persisted });
      await drainQueuedMessages();
    },
    [appendMessages, drainQueuedMessages, getQueuedMessages, saveUserMessage, sessionId]
  );

  const stop = useCallback(
    (stopBrowserTask = true) => {
      void stopRuntime(sessionId, stopBrowserTask);
      cancelPendingToolFlow();
      resetToolFlowState();
      getQueuedMessages(sessionId).length = 0;

      const stopMessage = createStoppedChatMessage();

      appendMessages([stopMessage]);
      void saveUserMessage(stopMessage);

      setStatus('idle');
      setError(null);

      logger.info('[AIChat] AI task stopped by user');
    },
    [
      appendMessages,
      cancelPendingToolFlow,
      getQueuedMessages,
      resetToolFlowState,
      saveUserMessage,
      sessionId,
      setError,
      setStatus,
      stopRuntime,
    ]
  );

  const clearMessages = useCallback(async () => {
    getQueuedMessages(sessionId).length = 0;
    await stopRuntime(sessionId, false);
    if (sessionId) {
      try {
        await stopActiveBrowserTask(sessionId, 'chat');
      } catch (error) {
        logger.error('[AIChat] Failed to stop browser tasks before clearing:', error);
      }
      await clearPersistedMessages(sessionId);
    }

    setMessagesWithRef(() => []);
    setStatus('idle');
    setError(null);
    resetToolFlowState();
    resetRuntimeState();
    isFirstMessageRef.current = true;
  }, [
    clearPersistedMessages,
    getQueuedMessages,
    isFirstMessageRef,
    resetRuntimeState,
    resetToolFlowState,
    sessionId,
    setError,
    setMessagesWithRef,
    setStatus,
    stopRuntime,
  ]);

  const editMessage = useCallback(
    async (messageId: string, content: string) => {
      const editedContent = content.trim();
      if (!sessionId || !editedContent) return;

      const messageIndex = messagesRef.current.findIndex((message) => message.id === messageId);
      if (messageIndex === -1 || messagesRef.current[messageIndex].role !== 'user') return;

      try {
        getQueuedMessages(sessionId).length = 0;
        await stopRuntime(sessionId, false);
        cancelPendingToolFlow(false);
        resetToolFlowState();
        resetRuntimeState();
        await stopActiveBrowserTask(sessionId, 'chat');
        await truncatePersistedMessages(sessionId, messageId);
        setMessagesWithRef((previous) => previous.slice(0, messageIndex));
        setStatus('idle');
        setError(null);
        isFirstMessageRef.current = messageIndex === 0;
        await sendMessage(editedContent);
      } catch (error) {
        handleChatError('[AIChat] Edit message error:', error);
      }
    },
    [
      cancelPendingToolFlow,
      getQueuedMessages,
      handleChatError,
      isFirstMessageRef,
      messagesRef,
      resetRuntimeState,
      resetToolFlowState,
      sendMessage,
      sessionId,
      setError,
      setMessagesWithRef,
      setStatus,
      stopRuntime,
      truncatePersistedMessages,
    ]
  );

  return {
    sendMessage,
    continueConversation,
    stop,
    clearMessages,
    editMessage,
  };
}
