import { db } from '@/db';
import type { QueuedAnalyticsEvent, StoredAnalyticsEvent } from './types';

/** 本地队列上限，超出丢弃最旧事件（只丢统计，不影响业务） */
export const ANALYTICS_QUEUE_LIMIT = 1000;

export async function enqueueEvents(events: QueuedAnalyticsEvent[]): Promise<number> {
  await db.analyticsEvents.bulkAdd(events);
  const count = await db.analyticsEvents.count();
  if (count > ANALYTICS_QUEUE_LIMIT) {
    const excessIds = await db.analyticsEvents
      .orderBy('id')
      .limit(count - ANALYTICS_QUEUE_LIMIT)
      .primaryKeys();
    await db.analyticsEvents.bulkDelete(excessIds);
  }
  return Math.min(count, ANALYTICS_QUEUE_LIMIT);
}

export async function loadOldestEvents(limit: number): Promise<StoredAnalyticsEvent[]> {
  const records = await db.analyticsEvents.orderBy('id').limit(limit).toArray();
  return records.filter((record): record is StoredAnalyticsEvent => typeof record.id === 'number');
}

export async function removeEventsUpTo(id: number): Promise<void> {
  await db.analyticsEvents.where('id').belowOrEqual(id).delete();
}

export async function clearAnalyticsQueue(): Promise<void> {
  await db.analyticsEvents.clear();
}
