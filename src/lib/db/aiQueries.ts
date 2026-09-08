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

export async function listSessionIdsWithMessages(): Promise<string[]> {
  const sessionIds = await getAIMessagesTable().orderBy('sessionId').uniqueKeys();
  return sessionIds.filter((sessionId): sessionId is string => typeof sessionId === 'string');
}

export async function searchSessionMessages(query: string): Promise<Record<string, string[]>> {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return {};

  const messages = (await getAIMessagesTable().toArray()).sort(
    (left, right) => left.createdAt - right.createdAt
  );
  const matches: Record<string, string[]> = {};
  for (const message of messages) {
    const content = message.content.toLocaleLowerCase();
    const sessionMatches = (matches[message.sessionId] ??= []);
    if (sessionMatches.length >= 8) continue;

    const ranges: Array<{ start: number; end: number }> = [];
    let matchIndex = content.indexOf(normalizedQuery);
    while (matchIndex !== -1) {
      const start = Math.max(0, matchIndex - 48);
      const end = Math.min(message.content.length, matchIndex + normalizedQuery.length + 96);
      const previousRange = ranges[ranges.length - 1];
      if (previousRange && start <= previousRange.end + 16) {
        previousRange.end = Math.max(previousRange.end, end);
      } else {
        ranges.push({ start, end });
      }
      matchIndex = content.indexOf(normalizedQuery, matchIndex + normalizedQuery.length);
    }

    for (const range of ranges) {
      if (sessionMatches.length >= 8) break;
      const snippet = `${range.start > 0 ? '...' : ''}${message.content.slice(range.start, range.end)}${
        range.end < message.content.length ? '...' : ''
      }`;
      if (!sessionMatches.includes(snippet)) sessionMatches.push(snippet);
    }
  }

  return matches;
}

export async function getMostRecentSession(): Promise<AISession | undefined> {
  const sessions = await getAISessionsTable().orderBy('updatedAt').reverse().limit(1).toArray();
  return sessions[0];
}
