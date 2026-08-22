import { db } from '@/db';
import type { AIMessage, AISession } from '@/db/types';

export type { AIMessage, AISession };
export type NewAIMessage = Omit<AIMessage, 'id' | 'createdAt'> & {
  id?: string;
  createdAt?: number;
};

export function getAISessionsTable() {
  return db.aiSessions;
}

export function getAIMessagesTable() {
  return db.aiMessages;
}

export function generateAIId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}
