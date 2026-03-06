// Unified AI database operations
import { db } from '@/db';
import type { AIMessage, AISession } from '@/db/types';

// Lazy getters to avoid "Cannot access 'db' before initialization" error
function getSessionsTable() {
  return db.aiSessions;
}

function getMessagesTable() {
  return db.aiMessages;
}

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

  await getSessionsTable().add(session);
  return session;
}

/**
 * Get a session by ID
 */
export async function getSession(id: string): Promise<AISession | undefined> {
  return getSessionsTable().get(id);
}

/**
 * List all sessions, sorted by updatedAt descending
 */
export async function listSessions(): Promise<AISession[]> {
  return getSessionsTable().orderBy('updatedAt').reverse().toArray();
}

/**
 * Update a session
 */
export async function updateSession(
  id: string,
  updates: Partial<Pick<AISession, 'title'>>
): Promise<void> {
  await getSessionsTable().update(id, {
    ...updates,
    updatedAt: Date.now(),
  });
}

/**
 * Delete a session and all its messages
 */
export async function deleteSession(id: string): Promise<void> {
  await db.transaction('rw', getSessionsTable(), getMessagesTable(), async () => {
    // Delete all messages in the session
    await getMessagesTable().where('sessionId').equals(id).delete();
    // Delete the session
    await getSessionsTable().delete(id);
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

  await getMessagesTable().add(newMessage);

  // Update session's updatedAt timestamp
  await getSessionsTable().update(message.sessionId, { updatedAt: Date.now() });

  return newMessage;
}

/**
 * Get all messages for a session, sorted by createdAt ascending
 */
export async function getMessagesBySession(sessionId: string): Promise<AIMessage[]> {
  return getMessagesTable().where('sessionId').equals(sessionId).sortBy('createdAt');
}

/**
 * Clear all messages in a session (but keep the session)
 */
export async function clearSessionMessages(sessionId: string): Promise<void> {
  await getMessagesTable().where('sessionId').equals(sessionId).delete();
}

/**
 * Get the most recent session (for initializing chat)
 */
export async function getMostRecentSession(): Promise<AISession | undefined> {
  const sessions = await getSessionsTable().orderBy('updatedAt').reverse().limit(1).toArray();
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
  await getSessionsTable().update(sessionId, { title, updatedAt: Date.now() });
}
