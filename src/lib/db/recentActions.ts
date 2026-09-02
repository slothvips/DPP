import { db } from '@/db';
import type { RecentAction, RecentActionType } from '@/db/types';
import { logger } from '@/utils/logger';

const MAX_RECENT_ACTIONS = 10;

export type RecentActionInput = Omit<RecentAction, 'id' | 'lastUsedAt'>;

function buildRecentActionId(action: RecentActionInput): string {
  return `${action.type}:${action.targetId}`;
}

export async function recordRecentAction(action: RecentActionInput): Promise<void> {
  try {
    const now = Date.now();
    const record: RecentAction = {
      ...action,
      id: buildRecentActionId(action),
      lastUsedAt: now,
    };

    await db.transaction('rw', db.recentActions, async () => {
      await db.recentActions.put(record);
      const staleIds = await db.recentActions
        .orderBy('lastUsedAt')
        .reverse()
        .offset(MAX_RECENT_ACTIONS)
        .primaryKeys();
      if (staleIds.length > 0) {
        await db.recentActions.bulkDelete(staleIds);
      }
    });
  } catch (error) {
    logger.error('Failed to record recent action:', error);
  }
}

export async function listRecentActions(): Promise<RecentAction[]> {
  return db.recentActions.orderBy('lastUsedAt').reverse().limit(MAX_RECENT_ACTIONS).toArray();
}

export async function deleteRecentAction(type: RecentActionType, targetId: string): Promise<void> {
  await db.recentActions.delete(`${type}:${targetId}`);
}
