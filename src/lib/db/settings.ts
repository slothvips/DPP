import { db } from '@/db';
import type { SettingKey } from '@/db/types';

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const setting = await db.settings.get(key as SettingKey);
  return setting?.value as T | undefined;
}

export async function updateSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key: key as SettingKey, value });
}
