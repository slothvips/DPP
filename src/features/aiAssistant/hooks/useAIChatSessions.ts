import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AISessionRoleSnapshot } from '@/features/aiAssistant/materials/testCaseTypes';
import {
  DEFAULT_AI_ROLE_ID,
  createDefaultRoleSnapshot,
  createRoleSnapshot,
} from '@/features/aiAssistant/roles/roleRuntime';
import {
  createSession,
  deleteSession as dbDeleteSession,
  getMessagesBySession,
  listSessions,
  updateSessionRole,
} from '@/lib/db/ai';
import { getRoleMaterial } from '@/lib/db/roles';
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
  currentRole: AISessionRoleSnapshot;
  loadSessions: () => Promise<void>;
  createNewSession: () => Promise<void>;
  selectRole: (roleId: string) => Promise<void>;
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
  const currentRole = useMemo(
    () => sessions.find((session) => session.id === sessionId)?.role ?? createDefaultRoleSnapshot(),
    [sessionId, sessions]
  );

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

      const session =
        reusableSession ?? (await createSession('新会话', createDefaultRoleSnapshot()));
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

  const selectRole = useCallback(
    async (roleId: string) => {
      if (!sessionId) throw new Error('缺少 AI 会话 ID');
      const messages = await getMessagesBySession(sessionId);
      if (messages.length > 0) throw new Error('已有消息的会话不能切换角色');

      const role =
        roleId === DEFAULT_AI_ROLE_ID
          ? createDefaultRoleSnapshot()
          : await getRoleMaterial(roleId).then((material) => {
              if (!material) throw new Error('角色不存在或已归档');
              return createRoleSnapshot(material);
            });
      await updateSessionRole(sessionId, role);
      await loadSessions();
    },
    [loadSessions, sessionId]
  );

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
    currentRole,
    loadSessions,
    createNewSession,
    selectRole,
    switchSession,
    deleteSession,
  };
}
