import { db } from '@/db';
import type { LinkItem, LinkStatItem, LinkTagItem } from '@/db/types';
import { getLinkTagsTable } from './linksShared';

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
  const page = args.page ?? 1;
  const pageSize = args.pageSize ?? 20;

  const [allLinks, allLinkTags, allTags, allStats] = await Promise.all([
    db.links.filter((link) => !link.deletedAt).toArray(),
    getLinkTagsTable()
      .filter((linkTag) => !linkTag.deletedAt)
      .toArray(),
    db.tags.filter((tag) => !tag.deletedAt).toArray(),
    db.linkStats.toArray(),
  ]);

  const tagsMap = new Map(allTags.map((tag) => [tag.id, tag]));
  const statsMap = new Map(allStats.map((stat) => [stat.id, stat]));
  const linkTagsMap = new Map<string, typeof allTags>();

  for (const linkTag of allLinkTags) {
    const tag = tagsMap.get(linkTag.tagId);
    if (!tag) {
      continue;
    }

    const current = linkTagsMap.get(linkTag.linkId) || [];
    current.push(tag);
    linkTagsMap.set(linkTag.linkId, current);
  }

  let filteredLinks = allLinks;
  if (args.keyword) {
    const keyword = args.keyword.toLowerCase();
    filteredLinks = filteredLinks.filter(
      (link) =>
        link.name.toLowerCase().includes(keyword) ||
        link.url.toLowerCase().includes(keyword) ||
        (link.note && link.note.toLowerCase().includes(keyword))
    );
  }

  if (args.tags && args.tags.length > 0) {
    const tagNameToId = new Map(allTags.map((tag) => [tag.name.toLowerCase(), tag.id]));
    const tagIdSet = new Set(
      args.tags.map((tag) =>
        tagNameToId.has(tag.toLowerCase()) ? tagNameToId.get(tag.toLowerCase())! : tag
      )
    );

    const linkIdsWithTags = new Set<string>();
    for (const linkTag of allLinkTags) {
      if (tagIdSet.has(linkTag.tagId)) {
        linkIdsWithTags.add(linkTag.linkId);
      }
    }

    filteredLinks = filteredLinks.filter((link) => linkIdsWithTags.has(link.id));
  }

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

  const total = linksWithTags.length;
  const startIndex = (page - 1) * pageSize;

  return {
    total,
    page,
    pageSize,
    hasMore: startIndex + pageSize < total,
    links: linksWithTags.slice(startIndex, startIndex + pageSize),
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
