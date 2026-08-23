import { useCallback, useRef } from 'react';
import { stopActiveBrowserTask } from '@/lib/ai/tools/browserTask';
import type { ChatMessage as ProviderChatMessage } from '@/lib/ai/types';
import { updateSessionTitle } from '@/lib/db/ai';
import { logger } from '@/utils/logger';
import type { ChatMessage } from '../types';
import type { AIChatStatus } from './useAIChat.types';
import {
  buildSendMessagePayload,
  createStoppedChatMessage,
  createUserChatMessage,
  handleAIChatActionError,
} from './useAIChatActions.shared';

interface UseAIChatActionsOptions {
  sessionId: string | null;
  status: AIChatStatus;
  isFirstMessageRef: React.MutableRefObject<boolean>;
  appendMessages: (messages: ChatMessage[]) => ChatMessage[];
  messagesRef: React.MutableRefObject<ChatMessage[]>;
  setMessagesWithRef: (updater: (prev: ChatMessage[]) => ChatMessage[]) => void;
  saveUserMessage: (message: ChatMessage) => Promise<void>;
  loadSessions: () => Promise<void>;
  runChatCompletion: (apiMessages: ProviderChatMessage[]) => Promise<ChatMessage>;
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
}: UseAIChatActionsOptions): UseAIChatActionsReturn {
  const queuedMessagesRef = useRef<ChatMessage[]>([]);
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

  const continueConversation = useCallback(
    async (allMessages: ChatMessage[]) => {
      resetRuntimeState();

      try {
        const assistantMessage = await runChatCompletion(allMessages.map(toLibChatMessage));
        await processAssistantResponse(assistantMessage);
      } catch (error) {
        handleChatError('[AIChat] Continue conversation error:', error);
      }
    },
    [
      handleChatError,
      processAssistantResponse,
      resetRuntimeState,
      runChatCompletion,
      toLibChatMessage,
    ]
  );

  const sendMessage = useCallback(
    async (content: string) => {
      const userMessage = createUserChatMessage(content);
      if (status === 'loading' || status === 'streaming' || status === 'confirming') {
        appendMessages([userMessage]);
        await saveUserMessage(userMessage);
        queuedMessagesRef.current.push(userMessage);
        return;
      }
      const nextMessages = appendMessages([userMessage]);
      resetToolFlowState();
      setStatus('loading');
      setError(null);

      await saveUserMessage(userMessage);

      try {
        const assistantMessage = await runChatCompletion(
          buildSendMessagePayload(nextMessages, userMessage, toLibChatMessage)
        );
        await processAssistantResponse(assistantMessage);
      } catch (error) {
        handleChatError('[AIChat] Chat error:', error);
      }

      if (sessionId && isFirstMessageRef.current) {
        isFirstMessageRef.current = false;
        try {
          const title = await generateSessionTitle(content);
          await updateSessionTitle(sessionId, title);
          await loadSessions();
        } catch (error) {
          logger.warn('[AIChat] Failed to generate session title:', error);
        }
      }

      while (queuedMessagesRef.current.length > 0) {
        const queuedMessage = queuedMessagesRef.current.shift();
        if (!queuedMessage) continue;
        resetToolFlowState();
        setStatus('loading');
        setError(null);
        try {
          const assistantMessage = await runChatCompletion(
            buildSendMessagePayload(messagesRef.current, queuedMessage, toLibChatMessage)
          );
          await processAssistantResponse(assistantMessage);
        } catch (error) {
          handleChatError('[AIChat] Queued chat error:', error);
        }
      }
    },
    [
      appendMessages,
      handleChatError,
      isFirstMessageRef,
      loadSessions,
      messagesRef,
      generateSessionTitle,
      processAssistantResponse,
      resetToolFlowState,
      runChatCompletion,
      saveUserMessage,
      sessionId,
      setError,
      setStatus,
      status,
      toLibChatMessage,
    ]
  );

  const stop = useCallback(
    (stopBrowserTask = true) => {
      stopRuntime(sessionId, stopBrowserTask);
      cancelPendingToolFlow();
      resetToolFlowState();
      queuedMessagesRef.current = [];

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
      resetToolFlowState,
      saveUserMessage,
      sessionId,
      setError,
      setStatus,
      stopRuntime,
    ]
  );

  const clearMessages = useCallback(async () => {
    queuedMessagesRef.current = [];
    stopRuntime(sessionId, false);
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
        queuedMessagesRef.current = [];
        stopRuntime(sessionId, false);
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
