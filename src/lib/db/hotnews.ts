// Unified hotnews database operations
import { db } from '@/db';
import type { HotNewsCache } from '@/db/types';
import { logger } from '@/utils/logger';

/**
 * Get hot news from cache
 */
export async function getHotNews(args: { date: string }): Promise<HotNewsCache | undefined> {
  return db.hotNews.get(args.date);
}

/**
 * Save hot news to cache
 */
export async function saveHotNews(args: { date: string; data: unknown }): Promise<void> {
  await db.hotNews.put({
    date: args.date,
    data: args.data,
    updatedAt: Date.now(),
  });
}

/**
 * Get all hot news keys
 */
export async function getAllHotNewsKeys(): Promise<string[]> {
  return db.hotNews.toCollection().keys() as Promise<string[]>;
}

/**
 * Bulk delete hot news by keys
 */
export async function bulkDeleteHotNews(keys: string[]): Promise<void> {
  if (keys.length > 0) {
    await db.hotNews.bulkDelete(keys);
  }
}

/**
 * Cleanup old hot news (keep only valid dates)
 */
export async function cleanupOldHotNews(validDates: Set<string>): Promise<void> {
  try {
    const allKeys = await getAllHotNewsKeys();
    const keysToDelete = allKeys.filter((key) => !validDates.has(key));
    if (keysToDelete.length > 0) {
      await bulkDeleteHotNews(keysToDelete);
    }
  } catch (error) {
    logger.debug('Cleanup old hot news failed:', error);
  }
}
