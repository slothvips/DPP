import type { Table } from 'dexie';
import { db } from '@/db';
import type { LinkTagItem } from '@/db/types';
import { logger } from '@/utils/logger';

export function getLinkTagsTable(): Table<LinkTagItem, [string, string]> {
  return db.linkTags as unknown as Table<LinkTagItem, [string, string]>;
}

export function isValidLinkUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (error) {
    logger.debug('Invalid URL:', url, error);
    return false;
  }
}

export async function resolveTagNamesToIds(tagsInput: string[]): Promise<string[]> {
  if (tagsInput.length === 0) {
    return [];
  }

  const tags = await db.tags.filter((tag) => !tag.deletedAt).toArray();
  const tagMap = new Map(tags.map((tag) => [tag.name.toLowerCase(), tag.id]));
  const idSet = new Set(tags.map((tag) => tag.id));

  return tagsInput
    .map((input) => {
      const trimmedInput = input.trim();
      if (!trimmedInput) {
        return null;
      }

      if (idSet.has(trimmedInput)) {
        return trimmedInput;
      }

      return tagMap.get(trimmedInput.toLowerCase());
    })
    .filter((id): id is string => !!id);
}
