// Unified AI database operations
import { db } from '@/db';
import type { AIMessage, AISession } from '@/db/types';

const sessionsTable = db.aiSessions;
const messagesTable = db.aiMessages;

/**
 * Generate a unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Create a new session
 */
export async function createSession(title: string): Promise<AISession> {
  const now = Date.now();
  const session: AISession = {
    id: generateId(),
    title,
    createdAt: now,
    updatedAt: now,
  };

  await sessionsTable.add(session);
  return session;
}

/**
 * Get a session by ID
 */
export async function getSession(id: string): Promise<AISession | undefined> {
  return sessionsTable.get(id);
}

/**
 * List all sessions, sorted by updatedAt descending
 */
export async function listSessions(): Promise<AISession[]> {
  return sessionsTable.orderBy('updatedAt').reverse().toArray();
}

/**
 * Update a session
 */
export async function updateSession(
  id: string,
  updates: Partial<Pick<AISession, 'title'>>
): Promise<void> {
  await sessionsTable.update(id, {
    ...updates,
    updatedAt: Date.now(),
  });
}

/**
 * Delete a session and all its messages
 */
export async function deleteSession(id: string): Promise<void> {
  await db.transaction('rw', sessionsTable, messagesTable, async () => {
    // Delete all messages in the session
    await messagesTable.where('sessionId').equals(id).delete();
    // Delete the session
    await sessionsTable.delete(id);
  });
}

/**
 * Add a message to a session
 */
export async function addMessage(message: Omit<AIMessage, 'id' | 'createdAt'>): Promise<AIMessage> {
  const newMessage: AIMessage = {
    ...message,
    id: generateId(),
    createdAt: Date.now(),
  };

  await messagesTable.add(newMessage);

  // Update session's updatedAt timestamp
  await sessionsTable.update(message.sessionId, { updatedAt: Date.now() });

  return newMessage;
}

/**
 * Get all messages for a session, sorted by createdAt ascending
 */
export async function getMessagesBySession(sessionId: string): Promise<AIMessage[]> {
  return messagesTable.where('sessionId').equals(sessionId).sortBy('createdAt');
}

/**
 * Clear all messages in a session (but keep the session)
 */
export async function clearSessionMessages(sessionId: string): Promise<void> {
  await messagesTable.where('sessionId').equals(sessionId).delete();
}

/**
 * Get the most recent session (for initializing chat)
 */
export async function getMostRecentSession(): Promise<AISession | undefined> {
  const sessions = await sessionsTable.orderBy('updatedAt').reverse().limit(1).toArray();
  return sessions[0];
}

/**
 * Update session title based on first user message
 */
export async function updateSessionTitle(
  sessionId: string,
  firstUserMessage: string
): Promise<void> {
  // Use first 30 chars of message as title, or "新会话" if empty
  const title = firstUserMessage.trim().slice(0, 30) || '新会话';
  await sessionsTable.update(sessionId, { title, updatedAt: Date.now() });
}
