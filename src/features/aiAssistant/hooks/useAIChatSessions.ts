import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createSession,
  deleteSession as dbDeleteSession,
  getMessagesBySession,
  listSessions,
} from '@/lib/db/ai';
import type { AISession, ChatMessage } from '../types';
import { listRemainingSessions, setStoredCurrentSessionId } from './useAIChatSessions.shared';

interface UseAIChatSessionsOptions {
  onMessagesLoaded: (sessionId: string, messages: ChatMessage[]) => void;
  onBeforeSessionSwitch: () => void;
  resetFirstMessageFlag: () => void;
}

interface UseAIChatSessionsReturn {
  sessionId: string | null;
  sessions: AISession[];
  loadSessions: () => Promise<void>;
  createNewSession: () => Promise<void>;
  switchSession: (id: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
}

export function useAIChatSessions({
  onMessagesLoaded,
  onBeforeSessionSwitch,
  resetFirstMessageFlag,
}: UseAIChatSessionsOptions): UseAIChatSessionsReturn {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<AISession[]>([]);
  const loadRequestIdRef = useRef(0);
  const initializedRef = useRef(false);

  const loadSession = useCallback(
    async (id: string) => {
      const requestId = ++loadRequestIdRef.current;
      const loadedMessages = await getMessagesBySession(id);
      if (requestId !== loadRequestIdRef.current) {
        return;
      }
      onMessagesLoaded(id, loadedMessages);
      setSessionId(id);
    },
    [onMessagesLoaded]
  );

  const loadSessions = useCallback(async () => {
    const loadedSessions = await listSessions();
    setSessions(loadedSessions);
  }, []);

  const createNewSession = useCallback(async () => {
    const session = await createSession('新会话');
    await loadSessions();
    await loadSession(session.id);
    resetFirstMessageFlag();
  }, [loadSession, loadSessions, resetFirstMessageFlag]);

  const switchSession = useCallback(
    async (id: string) => {
      onBeforeSessionSwitch();
      await loadSession(id);
    },
    [loadSession, onBeforeSessionSwitch]
  );

  const deleteSession = useCallback(
    async (id: string) => {
      await dbDeleteSession(id);
      await loadSessions();

      if (sessionId === id) {
        const remainingSessions = await listRemainingSessions();
        if (remainingSessions.length > 0) {
          await loadSession(remainingSessions[0].id);
        } else {
          await createNewSession();
        }
      }
    },
    [createNewSession, loadSession, loadSessions, sessionId]
  );

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      if (!mounted) {
        return;
      }

      await loadSessions();
      if (!mounted) {
        return;
      }

      await createNewSession();
      if (mounted) {
        initializedRef.current = true;
      }
    };

    void init();
    return () => {
      mounted = false;
      loadRequestIdRef.current += 1;
    };
  }, [createNewSession, loadSession, loadSessions]);

  useEffect(() => {
    let wasHidden = document.visibilityState === 'hidden';

    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible';
      const reopened = wasHidden && isVisible;
      wasHidden = !isVisible;

      if (reopened && initializedRef.current) {
        void createNewSession();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [createNewSession]);

  useEffect(() => {
    if (sessionId) {
      setStoredCurrentSessionId(sessionId);
    }
  }, [sessionId]);

  return {
    sessionId,
    sessions,
    loadSessions,
    createNewSession,
    switchSession,
    deleteSession,
  };
}
