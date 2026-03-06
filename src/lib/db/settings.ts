import { db } from '@/db';
import type { Setting, SettingKey } from '@/db/types';

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const setting = await db.settings.get(key as SettingKey);
  return setting?.value as T | undefined;
}

/**
 * Get a setting by key, returns the full Setting object
 */
export async function getSettingByKey(key: string): Promise<Setting | undefined> {
  return db.settings.where('key').equals(key).first() as Promise<Setting | undefined>;
}

export async function updateSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key: key as SettingKey, value });
}

/**
 * Delete a setting by key
 */
export async function deleteSetting(key: string): Promise<void> {
  await db.settings.delete(key as SettingKey);
}
