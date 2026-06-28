import type { LinkItem, LinkStatItem, LinkTagItem, TagItem } from '@/db';
import { buildLinkTagsMap } from '@/lib/db/linksShared';
import type { LinkWithStats } from './useLinks.types';

export function buildLinksWithStats(
  allLinks: LinkItem[],
  allStats: LinkStatItem[],
  allLinkTags: LinkTagItem[],
  allTags: TagItem[]
): LinkWithStats[] {
  const statsMap = new Map(allStats.map((stat) => [stat.id, stat]));
  const linkTagsMap = buildLinkTagsMap(allLinkTags, allTags);

  return allLinks.map((link) => ({
    ...link,
    usageCount: statsMap.get(link.id)?.usageCount || 0,
    lastUsedAt: statsMap.get(link.id)?.lastUsedAt || 0,
    pinnedAt: statsMap.get(link.id)?.pinnedAt,
    tags: linkTagsMap.get(link.id) || [],
  }));
}
