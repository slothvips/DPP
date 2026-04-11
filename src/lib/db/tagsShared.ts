import type { Table } from 'dexie';
import { db } from '@/db';
import type { JobTagItem, TagItem } from '@/db/types';

export function getJobTagsTable(): Table<JobTagItem, [string, string]> {
  return db.jobTags as unknown as Table<JobTagItem, [string, string]>;
}

export function buildRandomTagColor(): string {
  return `#${Math.floor(Math.random() * 16777215)
    .toString(16)
    .padStart(6, '0')}`;
}

export async function findTagByName(name: string): Promise<TagItem | undefined> {
  const normalizedName = name.trim().toLowerCase();
  if (!normalizedName) {
    return undefined;
  }

  return db.tags.filter((tag) => tag.name.toLowerCase() === normalizedName).first();
}
