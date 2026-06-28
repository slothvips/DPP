import type { Table } from 'dexie';
import { db } from '@/db';
import type { LinkTagItem, TagItem } from '@/db/types';
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

/**
 * 构建 linkId → TagItem[] 的映射表
 *
 * 抽取自 useLinksData.buildLinksWithStats 和 linksQueries.listLinks,
 * 消除两处重复的 Map join 逻辑。
 */
export function buildLinkTagsMap(
  allLinkTags: LinkTagItem[],
  allTags: TagItem[]
): Map<string, TagItem[]> {
  const tagsMap = new Map(allTags.map((tag) => [tag.id, tag]));
  const linkTagsMap = new Map<string, TagItem[]>();

  for (const linkTag of allLinkTags) {
    const tag = tagsMap.get(linkTag.tagId);
    if (!tag) {
      continue;
    }

    const current = linkTagsMap.get(linkTag.linkId) || [];
    current.push(tag);
    linkTagsMap.set(linkTag.linkId, current);
  }

  return linkTagsMap;
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
