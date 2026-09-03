import type { AISession } from '@/db/types';

export const AI_CURRENT_SESSION_STORAGE_KEY = 'ai_current_session_id';

export function setStoredCurrentSessionId(sessionId: string) {
  sessionStorage.setItem(AI_CURRENT_SESSION_STORAGE_KEY, sessionId);
}

export function planEmptySessionCleanup(
  sessions: AISession[],
  emptySessionIds: ReadonlySet<string>
) {
  const emptySessions = sessions.filter((session) => emptySessionIds.has(session.id));
  const reusableSession = emptySessions[0]?.id === sessions[0]?.id ? emptySessions[0] : null;

  return {
    reusableSession,
    staleSessionIds: emptySessions
      .filter((session) => session.id !== reusableSession?.id)
      .map((session) => session.id),
  };
}
