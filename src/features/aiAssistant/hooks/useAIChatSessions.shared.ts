import type { AISession } from '@/db/types';
import { getMostRecentSession, getSession, listSessions } from '@/lib/db/ai';

export const AI_CURRENT_SESSION_STORAGE_KEY = 'ai_current_session_id';

export function getStoredCurrentSessionId(): string | null {
  return sessionStorage.getItem(AI_CURRENT_SESSION_STORAGE_KEY);
}

export function setStoredCurrentSessionId(sessionId: string) {
  sessionStorage.setItem(AI_CURRENT_SESSION_STORAGE_KEY, sessionId);
}

export async function resolveInitialSessionId(): Promise<string | null> {
  const savedSessionId = getStoredCurrentSessionId();
  if (savedSessionId) {
    const session = await getSession(savedSessionId);
    if (session) {
      return savedSessionId;
    }
  }

  const recentSession = await getMostRecentSession();
  return recentSession?.id ?? null;
}

export async function listRemainingSessions(): Promise<AISession[]> {
  return listSessions();
}
