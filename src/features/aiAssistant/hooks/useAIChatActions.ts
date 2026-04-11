import { useCallback } from 'react';
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
  setMessagesWithRef: (updater: (prev: ChatMessage[]) => ChatMessage[]) => void;
  saveUserMessage: (message: ChatMessage) => Promise<void>;
  loadSessions: () => Promise<void>;
  runChatCompletion: (apiMessages: ProviderChatMessage[]) => Promise<ChatMessage>;
  processAssistantResponse: (assistantMessage: ChatMessage) => Promise<void>;
  toLibChatMessage: (message: ChatMessage) => ProviderChatMessage;
  resetRuntimeState: () => void;
  stopRuntime: () => void;
  resetToolFlowState: () => void;
  clearPersistedMessages: (sessionId: string) => void;
  setStatus: (status: AIChatStatus) => void;
  setError: (error: string | null) => void;
}

interface UseAIChatActionsReturn {
  sendMessage: (content: string) => Promise<void>;
  continueConversation: (allMessages: ChatMessage[]) => Promise<void>;
  stop: () => void;
  clearMessages: () => void;
}

export function useAIChatActions({
  sessionId,
  isFirstMessageRef,
  appendMessages,
  setMessagesWithRef,
  saveUserMessage,
  loadSessions,
  runChatCompletion,
  processAssistantResponse,
  toLibChatMessage,
  resetRuntimeState,
  stopRuntime,
  resetToolFlowState,
  clearPersistedMessages,
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

      if (sessionId && isFirstMessageRef.current) {
        await updateSessionTitle(sessionId, content);
        isFirstMessageRef.current = false;
        await loadSessions();
      }

      try {
        const assistantMessage = await runChatCompletion(
          buildSendMessagePayload(nextMessages, userMessage, toLibChatMessage)
        );
        await processAssistantResponse(assistantMessage);
      } catch (error) {
        handleChatError('[AIChat] Chat error:', error);
      }
    },
    [
      appendMessages,
      handleChatError,
      isFirstMessageRef,
      loadSessions,
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
    resetToolFlowState();

    const stopMessage = createStoppedChatMessage();

    appendMessages([stopMessage]);
    void saveUserMessage(stopMessage);

    setStatus('idle');
    setError(null);

    logger.info('[AIChat] AI task stopped by user');
  }, [appendMessages, resetToolFlowState, saveUserMessage, setError, setStatus, stopRuntime]);

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

  return {
    sendMessage,
    continueConversation,
    stop,
    clearMessages,
  };
}
