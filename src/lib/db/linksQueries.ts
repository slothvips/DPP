import { db } from '@/db';
import type { LinkItem, LinkStatItem, LinkTagItem } from '@/db/types';
import { buildLinkTagsMap, getLinkTagsTable } from './linksShared';
import { normalizePage } from './pagination';

export async function listLinks(args: {
  keyword?: string;
  tags?: string[];
  page?: number;
  pageSize?: number;
}): Promise<{
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  links: Array<{
    id: string;
    name: string;
    url: string;
    note?: string;
    tags: Array<{ id: string; name: string; color: string }>;
    usageCount: number;
    lastUsedAt?: number;
    createdAt: number;
    updatedAt: number;
  }>;
}> {
  const { page, pageSize, offset } = normalizePage(args, 20, 100);
  const keyword = args.keyword?.toLowerCase();
  const activeTags = args.tags && args.tags.length > 0;
  const allTags = activeTags ? await db.tags.filter((tag) => !tag.deletedAt).toArray() : [];
  let linkIdsWithTags: Set<string> | undefined;

  if (args.tags && args.tags.length > 0) {
    const allLinkTags = await getLinkTagsTable()
      .filter((linkTag) => !linkTag.deletedAt)
      .toArray();
    const tagNameToId = new Map(allTags.map((tag) => [tag.name.toLowerCase(), tag.id]));
    const tagIdSet = new Set(
      args.tags.map((tag) =>
        tagNameToId.has(tag.toLowerCase()) ? tagNameToId.get(tag.toLowerCase())! : tag
      )
    );

    linkIdsWithTags = new Set<string>();
    for (const linkTag of allLinkTags) {
      if (tagIdSet.has(linkTag.tagId)) {
        linkIdsWithTags.add(linkTag.linkId);
      }
    }
  }

  const matches = db.links
    .toCollection()
    .filter(
      (link) =>
        !link.deletedAt &&
        (!keyword ||
          link.name.toLowerCase().includes(keyword) ||
          link.url.toLowerCase().includes(keyword) ||
          Boolean(link.note?.toLowerCase().includes(keyword))) &&
        (!linkIdsWithTags || linkIdsWithTags.has(link.id))
    );
  const total = await matches.count();
  const filteredLinks = await matches.offset(offset).limit(pageSize).toArray();
  const linkIds = filteredLinks.map((link) => link.id);
  const [pageLinkTags, pageStats] = await Promise.all([
    getLinkTagsTable()
      .where('linkId')
      .anyOf(linkIds)
      .filter((linkTag) => !linkTag.deletedAt)
      .toArray(),
    db.linkStats.bulkGet(linkIds),
  ]);
  const pageTags =
    pageLinkTags.length > 0 ? await db.tags.bulkGet(pageLinkTags.map((item) => item.tagId)) : [];
  const statsMap = new Map(
    pageStats
      .filter((stat): stat is LinkStatItem => stat !== undefined)
      .map((stat) => [stat.id, stat])
  );
  const linkTagsMap = buildLinkTagsMap(
    pageLinkTags,
    pageTags.filter((tag) => tag !== undefined)
  );

  const linksWithTags = filteredLinks.map((link) => {
    const linkTags = linkTagsMap.get(link.id) || [];
    const stat = statsMap.get(link.id);

    return {
      id: link.id,
      name: link.name,
      url: link.url,
      note: link.note,
      tags: linkTags.map((tag) => ({ id: tag.id, name: tag.name, color: tag.color })),
      usageCount: stat?.usageCount || 0,
      lastUsedAt: stat?.lastUsedAt,
      createdAt: link.createdAt,
      updatedAt: link.updatedAt,
    };
  });

  return {
    total,
    page,
    pageSize,
    hasMore: offset + pageSize < total,
    links: linksWithTags,
  };
}

export async function getLink(args: {
  id: string;
}): Promise<{ id: string; name: string; url: string; note?: string } | null> {
  const link = await db.links.get(args.id);
  if (!link || link.deletedAt !== undefined) {
    return null;
  }

  return {
    id: link.id,
    name: link.name,
    url: link.url,
    note: link.note,
  };
}

export async function getLinkByUrl(url: string): Promise<LinkItem | null> {
  const link = await db.links.filter((item) => item.url === url && !item.deletedAt).first();
  return link || null;
}

export async function getAllActiveLinks(): Promise<LinkItem[]> {
  return db.links.filter((link) => !link.deletedAt).toArray();
}

export async function getAllActiveLinkTags(): Promise<LinkTagItem[]> {
  return db.linkTags.filter((linkTag) => !linkTag.deletedAt).toArray();
}

export async function getAllLinkStats(): Promise<LinkStatItem[]> {
  return db.linkStats.toArray();
}
