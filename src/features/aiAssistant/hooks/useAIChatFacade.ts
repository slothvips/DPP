import { useCallback, useEffect, useRef } from 'react';
import { ensureAIToolsRegistered } from '@/lib/ai';
import type { SessionAction } from '@/lib/ai/sessionActions';
import {
  clearSessionMessages,
  createSessionWithMessages,
  getMessagesBySession,
  getSession,
  truncateSessionFromMessage,
  updateSessionPinned,
  updateSessionTitle,
} from '@/lib/db/ai';
import {
  createConversationMaterial,
  createSessionFromConversation,
  getConversationMaterial,
} from '@/lib/db/conversations';
import { logger } from '@/utils/logger';
import type { ChatMessage } from '../types';
import type { UseAIChatReturn } from './useAIChat.types';
import { useAIChatActions } from './useAIChatActions';
import { useAIChatMessages } from './useAIChatMessages';
import { toProviderChatMessage, useAIChatPersistence } from './useAIChatPersistence';
import { useAIChatRuntime } from './useAIChatRuntime';
import { useAIChatSessionSummary } from './useAIChatSessionSummary';
import {
  resolveRoleSnapshot,
  resolveRoleSnapshotByTitle,
  useAIChatSessions,
} from './useAIChatSessions';
import { useAIChatState } from './useAIChatState';
import { useAIChatToolFlow } from './useAIChatToolFlow';
import { useYoloMode } from './useYoloMode';

export function useAIChatFacade(): UseAIChatReturn {
  const pendingInitialMessageRef = useRef<{ sessionId: string; content: string } | null>(null);
  useEffect(() => {
    ensureAIToolsRegistered();
  }, []);

  const { yoloMode, setYoloMode } = useYoloMode();
  const resetInitialSessionMessageFlag = useCallback(() => undefined, []);
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
    clearSessionMessages: clearInMemorySessionMessages,
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
    resetFirstMessageFlag: resetInitialSessionMessageFlag,
  });

  const {
    status,
    error,
    setStatus,
    setError,
    isFirstMessageRef,
    resetSessionScopedState,
    resetFirstMessageFlag,
    markSessionAsStarted,
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
  const handleSessionAction = useCallback(
    async (action: SessionAction) => {
      if (action.action === 'session_context_cleared') {
        if (!sessionId) return;
        await stopRuntime(sessionId);
        await clearSessionMessages(sessionId);
        clearInMemorySessionMessages(sessionId);
        resetRuntimeState();
        resetFirstMessageFlag();
        return;
      }

      const role = action.role_id
        ? await resolveRoleSnapshot(action.role_id)
        : action.role_title
          ? await resolveRoleSnapshotByTitle(action.role_title)
          : currentRole;
      if (!role) throw new Error('角色不存在、已删除或名称不唯一');
      const newSession = await createSessionWithMessages(
        action.title ?? '新会话',
        action.opening_message ? [{ role: 'assistant', content: action.opening_message }] : [],
        role
      );
      if (action.initial_user_message) {
        pendingInitialMessageRef.current = {
          sessionId: newSession.id,
          content: action.initial_user_message,
        };
      }
      await loadSessions();
      await switchSessionInternal(newSession.id);
      resetFirstMessageFlag();
    },
    [
      clearInMemorySessionMessages,
      currentRole,
      loadSessions,
      resetFirstMessageFlag,
      resetRuntimeState,
      sessionId,
      stopRuntime,
      switchSessionInternal,
    ]
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
    onSessionAction: handleSessionAction,
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

  useEffect(() => {
    const pending = pendingInitialMessageRef.current;
    if (!pending || pending.sessionId !== sessionId) return;
    pendingInitialMessageRef.current = null;
    void sendMessage(pending.content);
  }, [sendMessage, sessionId]);

  const createNewSession = useCallback(async () => {
    await createSession();
    resetFirstMessageFlag();
  }, [createSession, resetFirstMessageFlag]);

  const shareSession = useCallback(
    async (targetSessionId: string, input: { title: string; summary?: string }) => {
      const targetSession = await getSession(targetSessionId);
      if (!targetSession) throw new Error('会话不存在或已删除');
      if (getSessionStatus(targetSessionId) !== 'idle') {
        throw new Error('请等待会话完成后再分享');
      }

      const targetMessages = await getMessagesBySession(targetSessionId);
      if (targetMessages.length === 0) throw new Error('该会话没有可分享的消息');

      await createConversationMaterial({
        ...input,
        messages: targetMessages,
        role: targetSessionId === sessionId ? currentRole : targetSession.role,
      });
    },
    [currentRole, getSessionStatus, sessionId]
  );

  const importConversation = useCallback(
    async (materialId: string) => {
      const material = await getConversationMaterial(materialId);
      if (!material) throw new Error('会话物料不存在或已不可用');
      const session = await createSessionFromConversation(material);
      await loadSessions();
      await switchSessionInternal(session.id);
      markSessionAsStarted(session.id);
    },
    [loadSessions, markSessionAsStarted, switchSessionInternal]
  );

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

  const duplicateSession = useCallback(
    async (targetSessionId: string) => {
      const targetSession = await getSession(targetSessionId);
      if (!targetSession) throw new Error('会话不存在或已删除');
      if (getSessionStatus(targetSessionId) !== 'idle') {
        throw new Error('请等待会话完成后再复制');
      }

      const targetMessages = await getMessagesBySession(targetSessionId);
      if (targetMessages.length === 0) throw new Error('新会话没有可复制的消息');
      const session = await createSessionWithMessages(
        `副本：${targetSession.title}`.slice(0, 30),
        targetMessages,
        targetSession.role
      );
      await loadSessions();
      await switchSessionInternal(session.id);
      markSessionAsStarted(session.id);
    },
    [getSessionStatus, loadSessions, markSessionAsStarted, switchSessionInternal]
  );

  const renameSession = useCallback(
    async (targetSessionId: string, title: string) => {
      const targetSession = await getSession(targetSessionId);
      if (!targetSession) throw new Error('会话不存在或已删除');
      const targetMessages = await getMessagesBySession(targetSessionId);
      if (targetMessages.length === 0) {
        throw new Error('新会话暂不支持修改标题，请先发送消息');
      }
      if (getSessionStatus(targetSessionId) !== 'idle') {
        throw new Error('请等待会话完成后再修改标题');
      }
      await updateSessionTitle(targetSessionId, title);
      await loadSessions();
    },
    [getSessionStatus, loadSessions]
  );

  const setSessionPinned = useCallback(
    async (targetSessionId: string, pinned: boolean) => {
      if (!(await getSession(targetSessionId))) throw new Error('会话不存在或已删除');
      await updateSessionPinned(targetSessionId, pinned);
      await loadSessions();
    },
    [loadSessions]
  );

  const resetProvider = useCallback(() => {
    resetRuntimeProvider();
    logger.info('[AIChat] Provider cache reset');
  }, [resetRuntimeProvider]);

  const summarizeSession = useAIChatSessionSummary({
    sessionId,
    assistantLabel: currentRole.title,
    loadSessions,
    getProvider,
  });
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
    duplicateSession,
    updateSessionTitle: renameSession,
    setSessionPinned,
    resetProvider,
    completeBuild,
    cancelBuild,
    summarizeSession,
    shareSession,
    importConversation,
    setYoloMode,
  };
}
