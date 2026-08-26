import { useCallback, useRef, useState } from 'react';
import type { ChatMessage } from '../types';
import type { AIChatStatus } from './useAIChat.types';

interface SessionState {
  status: AIChatStatus;
  error: string | null;
}

export function useAIChatState(sessionId: string | null) {
  const sessionStatesRef = useRef(new Map<string, SessionState>());
  const [, setRevision] = useState(0);
  const firstMessageRefsRef = useRef(new Map<string, { current: boolean }>());
  const continueConversationRef = useRef(
    new Map<string, (allMessages: ChatMessage[]) => Promise<void>>()
  );

  const getSessionState = useCallback((id: string | null): SessionState => {
    if (!id) return { status: 'idle', error: null };
    const existing = sessionStatesRef.current.get(id);
    if (existing) return existing;
    const initial = { status: 'idle' as const, error: null };
    sessionStatesRef.current.set(id, initial);
    return initial;
  }, []);

  const updateSessionState = useCallback(
    (id: string | null, update: Partial<SessionState>) => {
      if (!id) return;
      const next = { ...getSessionState(id), ...update };
      sessionStatesRef.current.set(id, next);
      setRevision((value) => value + 1);
    },
    [getSessionState]
  );

  const isFirstMessageRef = sessionId
    ? firstMessageRefsRef.current.get(sessionId) || { current: true }
    : { current: true };
  if (sessionId && !firstMessageRefsRef.current.has(sessionId)) {
    firstMessageRefsRef.current.set(sessionId, isFirstMessageRef);
  }

  const setStatus = useCallback(
    (status: AIChatStatus) => updateSessionState(sessionId, { status }),
    [sessionId, updateSessionState]
  );

  const setError = useCallback(
    (error: string | null) => updateSessionState(sessionId, { error }),
    [sessionId, updateSessionState]
  );

  const resetSessionScopedState = useCallback(() => {
    updateSessionState(sessionId, { error: null, status: 'idle' });
  }, [sessionId, updateSessionState]);

  const resetFirstMessageFlag = useCallback(() => {
    const firstMessageRef = sessionId ? firstMessageRefsRef.current.get(sessionId) : undefined;
    if (firstMessageRef) firstMessageRef.current = true;
  }, [sessionId]);

  return {
    status: getSessionState(sessionId).status,
    error: getSessionState(sessionId).error,
    setStatus,
    setError,
    isFirstMessageRef,
    continueConversationRef,
    setContinueConversation: (callback: (allMessages: ChatMessage[]) => Promise<void>) => {
      if (sessionId) continueConversationRef.current.set(sessionId, callback);
    },
    getContinueConversation: (id: string | null) =>
      id ? continueConversationRef.current.get(id) : undefined,
    getSessionStatus: (id: string) => getSessionState(id).status,
    resetSessionScopedState,
    resetFirstMessageFlag,
    isRunning:
      getSessionState(sessionId).status === 'loading' ||
      getSessionState(sessionId).status === 'streaming',
  };
}
