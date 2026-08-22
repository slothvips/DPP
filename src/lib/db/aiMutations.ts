import { db } from '@/db';
import type { AIMessage, AISession } from '@/db/types';
import {
  type NewAIMessage,
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
    id: message.id ?? generateAIId(),
    createdAt: message.createdAt ?? Date.now(),
  };

  await getAIMessagesTable().add(newMessage);
  await getAISessionsTable().update(message.sessionId, { updatedAt: Date.now() });

  return newMessage;
}

export async function clearSessionMessages(sessionId: string): Promise<void> {
  await getAIMessagesTable().where('sessionId').equals(sessionId).delete();
}

export async function truncateSessionFromMessage(
  sessionId: string,
  messageId: string
): Promise<void> {
  const messages = await getAIMessagesTable()
    .where('sessionId')
    .equals(sessionId)
    .sortBy('createdAt');
  const messageIndex = messages.findIndex((message) => message.id === messageId);
  if (messageIndex === -1) return;

  await getAIMessagesTable().bulkDelete(messages.slice(messageIndex).map((message) => message.id));
}

export async function updateSessionTitle(sessionId: string, title: string): Promise<void> {
  await getAISessionsTable().update(sessionId, {
    title: title.trim().slice(0, 30) || '新会话',
    updatedAt: Date.now(),
  });
}
