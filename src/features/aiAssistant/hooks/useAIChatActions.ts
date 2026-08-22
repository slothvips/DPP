import { useCallback } from 'react';
import { resetPageAgentTaskGroup } from '@/lib/ai/tools/pageAgent';
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
  stopRuntime: () => void;
  cancelPendingToolFlow: () => void;
  resetToolFlowState: () => void;
  clearPersistedMessages: (sessionId: string) => void;
  truncatePersistedMessages: (sessionId: string, messageId: string) => Promise<void>;
  setStatus: (status: AIChatStatus) => void;
  setError: (error: string | null) => void;
}

interface UseAIChatActionsReturn {
  sendMessage: (content: string) => Promise<void>;
  continueConversation: (allMessages: ChatMessage[]) => Promise<void>;
  stop: () => void;
  clearMessages: () => void;
  editMessage: (messageId: string, content: string) => Promise<void>;
}

export function useAIChatActions({
  sessionId,
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
      const nextMessages = appendMessages([userMessage]);
      setStatus('loading');
      setError(null);

      await saveUserMessage(userMessage);

      try {
        await resetPageAgentTaskGroup();
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
    },
    [
      appendMessages,
      handleChatError,
      isFirstMessageRef,
      loadSessions,
      generateSessionTitle,
      processAssistantResponse,
      runChatCompletion,
      saveUserMessage,
      sessionId,
      setError,
      setStatus,
      toLibChatMessage,
    ]
  );

  const stop = useCallback(() => {
    stopRuntime();
    cancelPendingToolFlow();
    resetToolFlowState();

    const stopMessage = createStoppedChatMessage();

    appendMessages([stopMessage]);
    void saveUserMessage(stopMessage);

    setStatus('idle');
    setError(null);

    logger.info('[AIChat] AI task stopped by user');
  }, [
    appendMessages,
    cancelPendingToolFlow,
    resetToolFlowState,
    saveUserMessage,
    setError,
    setStatus,
    stopRuntime,
  ]);

  const clearMessages = useCallback(() => {
    if (sessionId) {
      clearPersistedMessages(sessionId);
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
  ]);

  const editMessage = useCallback(
    async (messageId: string, content: string) => {
      const editedContent = content.trim();
      if (!sessionId || !editedContent) return;

      const messageIndex = messagesRef.current.findIndex((message) => message.id === messageId);
      if (messageIndex === -1 || messagesRef.current[messageIndex].role !== 'user') return;

      try {
        stopRuntime();
        cancelPendingToolFlow();
        resetToolFlowState();
        resetRuntimeState();
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
