import { useCallback, useEffect } from 'react';
import { ensureAIToolsRegistered } from '@/lib/ai';
import { clearSessionMessages, truncateSessionFromMessage } from '@/lib/db/ai';
import { logger } from '@/utils/logger';
import type { ChatMessage } from '../types';
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
    messages,
    reasoning,
    setMessagesWithRef,
    appendMessages,
    createAssistantPlaceholder,
    handleStreamChunk,
    handleReasoningChunk,
    handleAssistantMessage,
    loadSessionMessages,
    getMessagesRef,
    setActiveSession,
  } = useAIChatMessages();

  const {
    sessionId,
    sessions,
    currentRole,
    loadSessions,
    createNewSession: createSession,
    selectRole,
    switchSession: switchSessionInternal,
    deleteSession: deleteSessionInternal,
  } = useAIChatSessions({
    onMessagesLoaded: loadSessionMessages,
    onBeforeSessionSwitch: () => undefined,
    resetFirstMessageFlag: () => undefined,
  });

  const {
    status,
    error,
    setStatus,
    setError,
    isFirstMessageRef,
    resetSessionScopedState,
    resetFirstMessageFlag,
    isRunning,
    setContinueConversation,
    getContinueConversation,
    getSessionStatus,
  } = useAIChatState(sessionId);

  useEffect(() => {
    setActiveSession(sessionId);
  }, [sessionId, setActiveSession]);

  const { saveUserMessage, saveAssistantMessage, saveToolMessages } =
    useAIChatPersistence(sessionId);

  const {
    currentProvider,
    currentProviderName,
    currentModel,
    generateSessionTitle,
    runChatCompletion,
    stopRuntime,
    resetRuntimeState,
    getProvider,
    resetProvider: resetRuntimeProvider,
  } = useAIChatRuntime({
    sessionId,
    role: currentRole,
    createAssistantPlaceholder,
    onStreamStart: () => setStatus('streaming'),
    onStreamChunk: handleStreamChunk,
    onReasoningChunk: handleReasoningChunk,
    onPersistAssistantMessage: saveAssistantMessage,
    onAssistantMessage: handleAssistantMessage,
  });

  const continueCurrentConversation = useCallback(async () => {
    const continuation = getContinueConversation(sessionId);
    if (continuation) await continuation(getMessagesRef(sessionId).current);
  }, [getContinueConversation, getMessagesRef, sessionId]);

  const appendCurrentMessages = useCallback(
    (newMessages: ChatMessage[]) => appendMessages(sessionId, newMessages),
    [appendMessages, sessionId]
  );
  const setCurrentMessages = useCallback(
    (updater: (previous: ChatMessage[]) => ChatMessage[]) => setMessagesWithRef(sessionId, updater),
    [sessionId, setMessagesWithRef]
  );
  const saveCurrentToolMessages = useCallback(
    (newMessages: ChatMessage[]) => saveToolMessages(newMessages),
    [saveToolMessages]
  );

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
    resetToolFlowStateForSession,
  } = useAIChatToolFlow({
    yoloMode,
    appendMessages: appendCurrentMessages,
    saveToolMessages: saveCurrentToolMessages,
    onContinueConversation: continueCurrentConversation,
    onStatusChange: setStatus,
    onAIConfigChanged: resetRuntimeProvider,
    sessionId,
    allowedToolNames: currentRole.allowedToolNames,
  });

  const { sendMessage, continueConversation, stop, clearMessages, editMessage } = useAIChatActions({
    sessionId,
    status,
    isFirstMessageRef,
    appendMessages: appendCurrentMessages,
    messagesRef: getMessagesRef(sessionId),
    setMessagesWithRef: setCurrentMessages,
    saveUserMessage,
    loadSessions,
    runChatCompletion,
    generateSessionTitle,
    processAssistantResponse,
    toLibChatMessage: toProviderChatMessage,
    resetRuntimeState,
    stopRuntime,
    cancelPendingToolFlow,
    resetToolFlowState,
    clearPersistedMessages: clearSessionMessages,
    truncatePersistedMessages: truncateSessionFromMessage,
    setStatus,
    setError,
    getSessionStatus,
  });

  setContinueConversation(continueConversation);

  const createNewSession = useCallback(async () => {
    await createSession();
    resetFirstMessageFlag();
  }, [createSession, resetFirstMessageFlag]);

  const switchSession = useCallback(
    async (id: string) => {
      await switchSessionInternal(id);
    },
    [switchSessionInternal]
  );

  const deleteSession = useCallback(
    async (id: string) => {
      await stopRuntime(id);
      resetToolFlowStateForSession(id);
      if (id === sessionId) {
        cancelPendingToolFlow();
        resetToolFlowState();
        resetSessionScopedState();
      }
      await deleteSessionInternal(id);
    },
    [
      cancelPendingToolFlow,
      deleteSessionInternal,
      resetSessionScopedState,
      resetToolFlowState,
      resetToolFlowStateForSession,
      sessionId,
      stopRuntime,
    ]
  );

  const resetProvider = useCallback(() => {
    resetRuntimeProvider();
    logger.info('[AIChat] Provider cache reset');
  }, [resetRuntimeProvider]);

  const summarizeSession = useAIChatSessionSummary({ sessionId, loadSessions, getProvider });
  const sessionStatuses = Object.fromEntries(
    sessions.map((session) => [session.id, getSessionStatus(session.id)])
  );

  return {
    messages,
    reasoning,
    status,
    error,
    pendingToolCall,
    pendingToolCalls,
    pendingBuild,
    sessionId,
    sessions,
    currentRole,
    sessionStatuses,
    currentProvider,
    currentProviderName,
    currentModel,
    yoloMode,
    isRunning,
    sendMessage,
    stop,
    confirmToolCall,
    confirmAllToolCalls,
    cancelToolCall,
    clearMessages,
    editMessage,
    createNewSession,
    selectRole,
    switchSession,
    deleteSession,
    resetProvider,
    completeBuild,
    cancelBuild,
    summarizeSession,
    setYoloMode,
  };
}
