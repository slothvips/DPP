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
  await db.transaction(
    'rw',
    getAISessionsTable(),
    getAIMessagesTable(),
    db.aiPlans,
    db.browserTasks,
    async () => {
      const taskIds = await db.browserTasks.where('sessionId').equals(id).primaryKeys();
      if (taskIds.length > 0) {
        await db.aiPlans.bulkDelete(taskIds.map((taskId) => `browser_task:${taskId}`));
      }
      await db.browserTasks.where('sessionId').equals(id).delete();
      await getAIMessagesTable().where('sessionId').equals(id).delete();
      await db.aiPlans.delete(`ai_session:${id}`);
      await getAISessionsTable().delete(id);
    }
  );
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
  await db.transaction('rw', getAIMessagesTable(), db.aiPlans, db.browserTasks, async () => {
    const taskIds = await db.browserTasks.where('sessionId').equals(sessionId).primaryKeys();
    if (taskIds.length > 0) {
      await db.aiPlans.bulkDelete(taskIds.map((taskId) => `browser_task:${taskId}`));
    }
    await db.browserTasks.where('sessionId').equals(sessionId).delete();
    await getAIMessagesTable().where('sessionId').equals(sessionId).delete();
    await db.aiPlans.delete(`ai_session:${sessionId}`);
  });
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

  const removedMessages = messages.slice(messageIndex);
  const removedToolCallIds = new Set(
    removedMessages.flatMap((message) => [
      ...(message.toolCalls?.map((toolCall) => toolCall.id) || []),
      ...(message.toolCallId ? [message.toolCallId] : []),
    ])
  );

  await db.transaction('rw', getAIMessagesTable(), db.aiPlans, db.browserTasks, async () => {
    if (removedToolCallIds.size > 0) {
      const taskIds = (await db.browserTasks.where('sessionId').equals(sessionId).toArray())
        .filter(({ summary }) =>
          summary.toolCallId ? removedToolCallIds.has(summary.toolCallId) : false
        )
        .map(({ taskId }) => taskId);
      if (taskIds.length > 0) {
        await db.aiPlans.bulkDelete(taskIds.map((taskId) => `browser_task:${taskId}`));
        await db.browserTasks.bulkDelete(taskIds);
      }
    }
    await getAIMessagesTable().bulkDelete(removedMessages.map((message) => message.id));
    await db.aiPlans.delete(`ai_session:${sessionId}`);
  });
}

export async function updateSessionTitle(sessionId: string, title: string): Promise<void> {
  await getAISessionsTable().update(sessionId, {
    title: title.trim().slice(0, 30) || '新会话',
    updatedAt: Date.now(),
  });
}
