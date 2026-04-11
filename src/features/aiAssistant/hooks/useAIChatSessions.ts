import { useCallback, useEffect, useState } from 'react';
import {
  createSession,
  deleteSession as dbDeleteSession,
  getMessagesBySession,
  listSessions,
} from '@/lib/db/ai';
import type { AISession, ChatMessage } from '../types';
import {
  listRemainingSessions,
  resolveInitialSessionId,
  setStoredCurrentSessionId,
} from './useAIChatSessions.shared';

interface UseAIChatSessionsOptions {
  onMessagesLoaded: (messages: ChatMessage[]) => void;
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

  const loadSession = useCallback(
    async (id: string) => {
      const loadedMessages = await getMessagesBySession(id);
      onMessagesLoaded(loadedMessages);
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

      const initialSessionId = await resolveInitialSessionId();
      if (!mounted) {
        return;
      }

      if (initialSessionId) {
        await loadSession(initialSessionId);
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
