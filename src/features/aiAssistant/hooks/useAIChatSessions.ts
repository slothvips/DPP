import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import type { AISessionRoleSnapshot } from '@/features/aiAssistant/materials/testCaseTypes';
import {
  createBuiltInRoleSnapshot,
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
import { getRoleMaterial, listRoleMaterials } from '@/lib/db/roles';
import { logger } from '@/utils/logger';
import type { AISession, ChatMessage } from '../types';
import {
  AI_CURRENT_SESSION_STORAGE_KEY,
  planEmptySessionCleanup,
} from './useAIChatSessions.shared';

const PREFERRED_AI_ROLE_STORAGE_KEY = 'dpp_ai_preferred_role_id';

export async function resolveRoleSnapshot(
  roleId: string
): Promise<AISessionRoleSnapshot | undefined> {
  const builtInRole = createBuiltInRoleSnapshot(roleId);
  if (builtInRole) return builtInRole;

  const material = await getRoleMaterial(roleId);
  return material ? createRoleSnapshot(material) : undefined;
}

export async function resolveRoleSnapshotByTitle(
  roleTitle: string
): Promise<AISessionRoleSnapshot | undefined> {
  const defaultRole = createDefaultRoleSnapshot();
  if (defaultRole.title === roleTitle) return defaultRole;
  const matches = (await listRoleMaterials()).filter((role) => role.title === roleTitle);
  return matches.length === 1 ? createRoleSnapshot(matches[0]) : undefined;
}

async function loadPreferredRoleSnapshot(): Promise<AISessionRoleSnapshot> {
  try {
    const stored = await browser.storage.local.get(PREFERRED_AI_ROLE_STORAGE_KEY);
    const roleId = stored[PREFERRED_AI_ROLE_STORAGE_KEY];
    if (typeof roleId !== 'string') return createDefaultRoleSnapshot();

    const role = await resolveRoleSnapshot(roleId);
    if (role) return role;

    await browser.storage.local.remove(PREFERRED_AI_ROLE_STORAGE_KEY);
  } catch (error) {
    logger.warn('[AIChat] Failed to load preferred role:', error);
  }

  return createDefaultRoleSnapshot();
}

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
  const currentSessionIdRef = useRef<string | null>(null);
  const currentRole = useMemo(() => {
    const storedRole = sessions.find((session) => session.id === sessionId)?.role;
    if (!storedRole || storedRole.roleId === 'builtin:cyber-foreman') {
      return createDefaultRoleSnapshot();
    }
    return createBuiltInRoleSnapshot(storedRole.roleId) ?? storedRole;
  }, [sessionId, sessions]);

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

      const preferredRole = await loadPreferredRoleSnapshot();
      const session = reusableSession ?? (await createSession('新会话', preferredRole));
      if (reusableSession && reusableSession.role?.roleId !== preferredRole.roleId) {
        await updateSessionRole(reusableSession.id, preferredRole);
      }
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

      const role = await resolveRoleSnapshot(roleId);
      if (!role) throw new Error('角色不存在或已删除');
      await updateSessionRole(sessionId, role);
      await browser.storage.local.set({ [PREFERRED_AI_ROLE_STORAGE_KEY]: roleId });
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

      const loadedSessions = await listSessions();
      setSessions(loadedSessions);
      if (!mounted) {
        return;
      }

      const storedSession = await browser.storage.session.get(AI_CURRENT_SESSION_STORAGE_KEY);
      const importedSessionId = storedSession[AI_CURRENT_SESSION_STORAGE_KEY];
      if (
        typeof importedSessionId === 'string' &&
        loadedSessions.some((session) => session.id === importedSessionId)
      ) {
        await browser.storage.session.remove(AI_CURRENT_SESSION_STORAGE_KEY);
        await loadSession(importedSessionId);
        resetFirstMessageFlag();
        return;
      }

      await createNewSession();
    };

    void init();
    return () => {
      mounted = false;
      loadRequestIdRef.current += 1;
    };
  }, [createNewSession, loadSession, resetFirstMessageFlag]);

  useEffect(() => {
    currentSessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    const handleSessionStorageChange = (changes: {
      [key: string]: chrome.storage.StorageChange;
    }) => {
      const importedSessionId = changes[AI_CURRENT_SESSION_STORAGE_KEY]?.newValue;
      if (
        typeof importedSessionId !== 'string' ||
        importedSessionId === currentSessionIdRef.current
      ) {
        return;
      }

      void (async () => {
        const loadedSessions = await listSessions();
        if (!loadedSessions.some((session) => session.id === importedSessionId)) return;
        await browser.storage.session.remove(AI_CURRENT_SESSION_STORAGE_KEY);
        onBeforeSessionSwitch();
        await loadSession(importedSessionId);
        resetFirstMessageFlag();
      })().catch((error: unknown) => {
        logger.warn('[AIChat] Failed to switch to imported session:', error);
      });
    };

    browser.storage.session.onChanged.addListener(handleSessionStorageChange);
    return () => browser.storage.session.onChanged.removeListener(handleSessionStorageChange);
  }, [loadSession, onBeforeSessionSwitch, resetFirstMessageFlag]);

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
