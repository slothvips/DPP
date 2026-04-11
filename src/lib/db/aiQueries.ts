import type { AIMessage, AISession } from '@/db/types';
import { getAIMessagesTable, getAISessionsTable } from './aiShared';

export async function getSession(id: string): Promise<AISession | undefined> {
  return getAISessionsTable().get(id);
}

export async function listSessions(): Promise<AISession[]> {
  return getAISessionsTable().orderBy('updatedAt').reverse().toArray();
}

export async function getMessagesBySession(sessionId: string): Promise<AIMessage[]> {
  return getAIMessagesTable().where('sessionId').equals(sessionId).sortBy('createdAt');
}

export async function getMostRecentSession(): Promise<AISession | undefined> {
  const sessions = await getAISessionsTable().orderBy('updatedAt').reverse().limit(1).toArray();
  return sessions[0];
}
