import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createSession,
  deleteSession as dbDeleteSession,
  getMessagesBySession,
  listSessions,
} from '@/lib/db/ai';
import type { AISession, ChatMessage } from '../types';
import { planEmptySessionCleanup, setStoredCurrentSessionId } from './useAIChatSessions.shared';

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
  const newSessionRequestRef = useRef<Promise<void> | null>(null);

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
    if (newSessionRequestRef.current) {
      await newSessionRequestRef.current;
      return;
    }

    const request = (async () => {
      const loadedSessions = await listSessions();
      const emptySessionIds = new Set(
        (
          await Promise.all(
            loadedSessions
              .filter((session) => session.title === '新会话')
              .map(async (session) => {
                const messages = await getMessagesBySession(session.id);
                return messages.length === 0 ? session.id : null;
              })
          )
        ).filter((id): id is string => id !== null)
      );
      const { reusableSession, staleSessionIds } = planEmptySessionCleanup(
        loadedSessions,
        emptySessionIds
      );

      for (const id of staleSessionIds) {
        await dbDeleteSession(id);
      }

      const session = reusableSession ?? (await createSession('新会话'));
      await loadSessions();
      await loadSession(session.id);
      resetFirstMessageFlag();
    })();

    newSessionRequestRef.current = request;
    try {
      await request;
    } finally {
      if (newSessionRequestRef.current === request) {
        newSessionRequestRef.current = null;
      }
    }
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
        const remainingSessions = await listSessions();
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
    };

    void init();
    return () => {
      mounted = false;
      loadRequestIdRef.current += 1;
    };
  }, [createNewSession, loadSession, loadSessions]);

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
