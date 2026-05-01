import { useCallback, useEffect } from 'react';
import { ensureAIToolsRegistered } from '@/lib/ai';
import { clearSessionMessages } from '@/lib/db/ai';
import { logger } from '@/utils/logger';
import type { UseAIChatReturn } from './useAIChat.types';
import { useAIChatActions } from './useAIChatActions';
import { useAIChatMessages } from './useAIChatMessages';
import { toProviderChatMessage, useAIChatPersistence } from './useAIChatPersistence';
import { useAIChatRuntime } from './useAIChatRuntime';
import { useAIChatSessionSummary } from './useAIChatSessionSummary';
import { useAIChatSessions } from './useAIChatSessions';
import { useAIChatState } from './useAIChatState';
import { useAIChatToolFlow } from './useAIChatToolFlow';
import { useYoloMode } from './useYoloMode';

export function useAIChatFacade(): UseAIChatReturn {
  useEffect(() => {
    ensureAIToolsRegistered();
  }, []);

  const { yoloMode, setYoloMode } = useYoloMode();
  const {
    status,
    error,
    setStatus,
    setError,
    isFirstMessageRef,
    continueConversationRef,
    resetSessionScopedState,
    resetFirstMessageFlag,
    isRunning,
  } = useAIChatState();

  const {
    messages,
    messagesRef,
    setMessagesWithRef,
    appendMessages,
    createAssistantPlaceholder,
    handleStreamChunk,
    handleAssistantMessage,
    loadSessionMessages,
  } = useAIChatMessages();

  const {
    sessionId,
    sessions,
    loadSessions,
    createNewSession: createSession,
    switchSession: switchSessionInternal,
    deleteSession: deleteSessionInternal,
  } = useAIChatSessions({
    onMessagesLoaded: loadSessionMessages,
    onBeforeSessionSwitch: resetSessionScopedState,
    resetFirstMessageFlag,
  });

  const { saveUserMessage, saveAssistantMessage, saveToolMessages } =
    useAIChatPersistence(sessionId);

  const {
    currentProvider,
    runChatCompletion,
    stopRuntime,
    resetRuntimeState,
    resetProvider: resetRuntimeProvider,
  } = useAIChatRuntime({
    createAssistantPlaceholder,
    onStreamStart: () => setStatus('streaming'),
    onStreamChunk: handleStreamChunk,
    onPersistAssistantMessage: saveAssistantMessage,
    onAssistantMessage: handleAssistantMessage,
  });

  const continueCurrentConversation = useCallback(async () => {
    await continueConversationRef.current?.(messagesRef.current);
  }, [continueConversationRef, messagesRef]);

  const {
    pendingToolCall,
    pendingToolCalls,
    pendingBuild,
    processAssistantResponse,
    confirmToolCall,
    confirmAllToolCalls,
    cancelToolCall,
    completeBuild,
    cancelBuild,
    cancelPendingToolFlow,
    resetToolFlowState,
  } = useAIChatToolFlow({
    yoloMode,
    appendMessages,
    saveToolMessages,
    onContinueConversation: continueCurrentConversation,
    onStatusChange: setStatus,
    onAIConfigChanged: resetRuntimeProvider,
  });

  const { sendMessage, continueConversation, stop, clearMessages } = useAIChatActions({
    sessionId,
    isFirstMessageRef,
    appendMessages,
    setMessagesWithRef,
    saveUserMessage,
    loadSessions,
    runChatCompletion,
    processAssistantResponse,
    toLibChatMessage: toProviderChatMessage,
    resetRuntimeState,
    stopRuntime,
    cancelPendingToolFlow,
    resetToolFlowState,
    clearPersistedMessages: (currentSessionId) => {
      void clearSessionMessages(currentSessionId);
    },
    setStatus,
    setError,
  });

  continueConversationRef.current = continueConversation;

  const resetBeforeLeavingSession = useCallback(() => {
    stopRuntime();
    cancelPendingToolFlow();
    resetToolFlowState();
    resetSessionScopedState();
  }, [cancelPendingToolFlow, resetSessionScopedState, resetToolFlowState, stopRuntime]);

  const createNewSession = useCallback(async () => {
    resetBeforeLeavingSession();
    await createSession();
  }, [createSession, resetBeforeLeavingSession]);

  const switchSession = useCallback(
    async (id: string) => {
      resetBeforeLeavingSession();
      await switchSessionInternal(id);
    },
    [resetBeforeLeavingSession, switchSessionInternal]
  );

  const deleteSession = useCallback(
    async (id: string) => {
      if (id === sessionId) {
        resetBeforeLeavingSession();
      }
      await deleteSessionInternal(id);
    },
    [deleteSessionInternal, resetBeforeLeavingSession, sessionId]
  );

  const resetProvider = useCallback(() => {
    resetRuntimeProvider();
    logger.info('[AIChat] Provider cache reset');
  }, [resetRuntimeProvider]);

  const summarizeSession = useAIChatSessionSummary({
    sessionId,
    loadSessions,
  });

  return {
    messages,
    status,
    error,
    pendingToolCall,
    pendingToolCalls,
    pendingBuild,
    sessionId,
    sessions,
    currentProvider,
    yoloMode,
    isRunning,
    sendMessage,
    stop,
    confirmToolCall,
    confirmAllToolCalls,
    cancelToolCall,
    clearMessages,
    createNewSession,
    switchSession,
    deleteSession,
    resetProvider,
    completeBuild,
    cancelBuild,
    summarizeSession,
    setYoloMode,
  };
}
