import type { AISession } from '@/db/types';
import { listSessions } from '@/lib/db/ai';

export const AI_CURRENT_SESSION_STORAGE_KEY = 'ai_current_session_id';

export function setStoredCurrentSessionId(sessionId: string) {
  sessionStorage.setItem(AI_CURRENT_SESSION_STORAGE_KEY, sessionId);
}

export async function listRemainingSessions(): Promise<AISession[]> {
  return listSessions();
}
