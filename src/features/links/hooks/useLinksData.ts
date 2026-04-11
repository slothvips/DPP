import type { LinkItem, LinkStatItem, LinkTagItem, TagItem } from '@/db';
import type { LinkWithStats } from './useLinks.types';

export function buildLinksWithStats(
  allLinks: LinkItem[],
  allStats: LinkStatItem[],
  allLinkTags: LinkTagItem[],
  allTags: TagItem[]
): LinkWithStats[] {
  const statsMap = new Map(allStats.map((stat) => [stat.id, stat]));
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

  return allLinks.map((link) => ({
    ...link,
    usageCount: statsMap.get(link.id)?.usageCount || 0,
    lastUsedAt: statsMap.get(link.id)?.lastUsedAt || 0,
    pinnedAt: statsMap.get(link.id)?.pinnedAt,
    tags: linkTagsMap.get(link.id) || [],
  }));
}
