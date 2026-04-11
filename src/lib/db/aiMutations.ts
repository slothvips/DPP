import { db } from '@/db';
import type { AIMessage, AISession } from '@/db/types';
import {
  type NewAIMessage,
  createSessionTitleFromMessage,
  generateAIId,
  getAIMessagesTable,
  getAISessionsTable,
} from './aiShared';

export async function createSession(title: string): Promise<AISession> {
  const now = Date.now();
  const session: AISession = {
    id: generateAIId(),
    title,
    createdAt: now,
    updatedAt: now,
  };

  await getAISessionsTable().add(session);
  return session;
}

export async function updateSession(
  id: string,
  updates: Partial<Pick<AISession, 'title'>>
): Promise<void> {
  await getAISessionsTable().update(id, {
    ...updates,
    updatedAt: Date.now(),
  });
}

export async function deleteSession(id: string): Promise<void> {
  await db.transaction('rw', getAISessionsTable(), getAIMessagesTable(), async () => {
    await getAIMessagesTable().where('sessionId').equals(id).delete();
    await getAISessionsTable().delete(id);
  });
}

export async function addMessage(message: NewAIMessage): Promise<AIMessage> {
  const newMessage: AIMessage = {
    ...message,
    id: generateAIId(),
    createdAt: Date.now(),
  };

  await getAIMessagesTable().add(newMessage);
  await getAISessionsTable().update(message.sessionId, { updatedAt: Date.now() });

  return newMessage;
}

export async function clearSessionMessages(sessionId: string): Promise<void> {
  await getAIMessagesTable().where('sessionId').equals(sessionId).delete();
}

export async function updateSessionTitle(
  sessionId: string,
  firstUserMessage: string
): Promise<void> {
  await getAISessionsTable().update(sessionId, {
    title: createSessionTitleFromMessage(firstUserMessage),
    updatedAt: Date.now(),
  });
}
