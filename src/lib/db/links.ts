// Unified links database operations
import type { Table } from 'dexie';
import { db } from '@/db';
import type { LinkItem, LinkStatItem, LinkTagItem } from '@/db/types';
import { logger } from '@/utils/logger';

// Lazy getter to avoid "Cannot access 'db' before initialization" error
function getLinkTagsTable(): Table<LinkTagItem, [string, string]> {
  return db.linkTags as unknown as Table<LinkTagItem, [string, string]>;
}

/**
 * Validate URL format
 */
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (error) {
    logger.debug('Invalid URL:', url, error);
    return false;
  }
}

/**
 * Convert tag names to tag IDs
 * Handles both tag names (from AI) and tag IDs (from UI)
 */
async function resolveTagNamesToIds(tagsInput: string[]): Promise<string[]> {
  if (tagsInput.length === 0) return [];

  const tags = await db.tags.filter((t) => !t.deletedAt).toArray();
  const tagMap = new Map(tags.map((t) => [t.name.toLowerCase(), t.id]));
  const idSet = new Set(tags.map((t) => t.id));

  return tagsInput
    .map((input) => {
      // If it looks like a UUID (contains dashes), treat it as an ID
      if (input.includes('-') && idSet.has(input)) {
        return input;
      }
      // Otherwise, treat it as a name and look it up
      return tagMap.get(input.toLowerCase());
    })
    .filter((id): id is string => !!id);
}

/**
 * List all links, optionally filtered by keyword and tags with pagination support
 * Optimized to avoid N+1 queries by batch loading all related data
 */
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
  // Batch load all data in parallel to avoid N+1 queries
  const [allLinks, allLinkTags, allTags, allStats] = await Promise.all([
    db.links.filter((l) => !l.deletedAt).toArray(),
    getLinkTagsTable()
      .filter((lt) => !lt.deletedAt)
      .toArray(),
    db.tags.filter((t) => !t.deletedAt).toArray(),
    db.linkStats.toArray(),
  ]);

  // Build lookup maps for O(1) access
  const tagsMap = new Map(allTags.map((t) => [t.id, t]));
  const statsMap = new Map(allStats.map((s) => [s.id, s]));

  // Build linkId -> tags map
  const linkTagsMap = new Map<string, typeof allTags>();
  for (const lt of allLinkTags) {
    const tag = tagsMap.get(lt.tagId);
    if (tag) {
      const current = linkTagsMap.get(lt.linkId) || [];
      current.push(tag);
      linkTagsMap.set(lt.linkId, current);
    }
  }

  // Filter links by keyword if provided
  let filteredLinks = allLinks;
  if (args.keyword) {
    const keyword = args.keyword.toLowerCase();
    filteredLinks = filteredLinks.filter(
      (l) =>
        l.name.toLowerCase().includes(keyword) ||
        l.url.toLowerCase().includes(keyword) ||
        (l.note && l.note.toLowerCase().includes(keyword))
    );
  }

  // Filter by tags if provided (supports both tag names and tag IDs)
  if (args.tags && args.tags.length > 0) {
    const tagNameToId = new Map(allTags.map((t) => [t.name.toLowerCase(), t.id]));
    const tagIdSet = new Set(
      args.tags.map((t) =>
        tagNameToId.has(t.toLowerCase()) ? tagNameToId.get(t.toLowerCase())! : t
      )
    );

    // Build linkIds that have all the specified tags
    const linkIdsWithTags = new Set<string>();
    for (const lt of allLinkTags) {
      if (tagIdSet.has(lt.tagId)) {
        linkIdsWithTags.add(lt.linkId);
      }
    }
    filteredLinks = filteredLinks.filter((l) => linkIdsWithTags.has(l.id));
  }

  // Build result using pre-loaded maps
  const linksWithTags = filteredLinks.map((link) => {
    const linkTags = linkTagsMap.get(link.id) || [];
    const stat = statsMap.get(link.id);

    return {
      id: link.id,
      name: link.name,
      url: link.url,
      note: link.note,
      tags: linkTags.map((t) => ({ id: t.id, name: t.name, color: t.color })),
      usageCount: stat?.usageCount || 0,
      lastUsedAt: stat?.lastUsedAt,
      createdAt: link.createdAt,
      updatedAt: link.updatedAt,
    };
  });

  const total = linksWithTags.length;
  const startIndex = (page - 1) * pageSize;
  const paginatedLinks = linksWithTags.slice(startIndex, startIndex + pageSize);

  return {
    total,
    page,
    pageSize,
    hasMore: startIndex + pageSize < total,
    links: paginatedLinks,
  };
}

/**
 * Add a new link
 * @param args - Link data, tags can be tag names (AI) or tag IDs (UI)
 */
export async function addLink(args: {
  name: string;
  url: string;
  note?: string;
  tags?: string[];
}): Promise<{ success: boolean; id: string; message: string }> {
  // Validate URL format
  if (!isValidUrl(args.url)) {
    throw new Error(`URL 格式不正确，请以 http:// 或 https:// 开头`);
  }

  const now = Date.now();
  const id = crypto.randomUUID();

  // Resolve tag names to IDs if needed
  const tagIds = args.tags ? await resolveTagNamesToIds(args.tags) : [];

  await db.transaction('rw', db.links, getLinkTagsTable(), async () => {
    // Create link
    await db.links.add({
      id,
      name: args.name,
      url: args.url,
      note: args.note,
      category: '',
      createdAt: now,
      updatedAt: now,
    });

    // Add tags if provided
    if (tagIds.length > 0) {
      for (const tagId of tagIds) {
        await getLinkTagsTable().add({
          linkId: id,
          tagId,
          updatedAt: now,
        });
      }
    }
  });

  return {
    success: true,
    id,
    message: `Link "${args.name}" added successfully`,
  };
}

/**
 * Update an existing link
 * @param args - Link data, tags can be tag names (AI) or tag IDs (UI)
 */
export async function updateLink(args: {
  id: string;
  name?: string;
  url?: string;
  note?: string;
  tags?: string[];
}): Promise<{ success: boolean; message: string }> {
  const existingLink = await db.links.get(args.id);
  if (!existingLink) {
    throw new Error(`链接不存在或已被删除`);
  }

  if (args.url && !isValidUrl(args.url)) {
    throw new Error(`URL 格式不正确，请以 http:// 或 https:// 开头`);
  }

  const now = Date.now();

  const newTagIds = args.tags ? await resolveTagNamesToIds(args.tags) : undefined;

  const existingLinkTags =
    newTagIds !== undefined
      ? await getLinkTagsTable().where('linkId').equals(args.id).toArray()
      : [];

  const existingTagIds = new Set(
    existingLinkTags.filter((lt) => !lt.deletedAt).map((lt) => lt.tagId)
  );

  const toAdd: LinkTagItem[] = [];
  const toUpdate: LinkTagItem[] = [];
  const toDelete: Array<[string, string]> = [];

  if (newTagIds !== undefined) {
    const tagIdSet = new Set(newTagIds);

    for (const tagId of newTagIds) {
      if (!existingTagIds.has(tagId)) {
        const deletedTag = existingLinkTags.find((lt) => lt.tagId === tagId && lt.deletedAt);
        if (deletedTag) {
          toUpdate.push({ ...deletedTag, deletedAt: undefined, updatedAt: now });
        } else {
          toAdd.push({ linkId: args.id, tagId, updatedAt: now });
        }
      }
    }

    for (const existingId of existingTagIds) {
      if (!tagIdSet.has(existingId)) {
        toDelete.push([args.id, existingId]);
      }
    }
  }

  await db.transaction('rw', db.links, getLinkTagsTable(), async () => {
    await db.links.update(args.id, {
      name: args.name ?? existingLink.name,
      url: args.url ?? existingLink.url,
      note: args.note ?? existingLink.note,
      updatedAt: now,
    });

    if (newTagIds !== undefined) {
      if (toAdd.length > 0) {
        await getLinkTagsTable().bulkAdd(toAdd);
      }
      if (toUpdate.length > 0) {
        await getLinkTagsTable().bulkPut(toUpdate);
      }
      for (const [linkId, tagId] of toDelete) {
        await getLinkTagsTable()
          .where({ linkId, tagId })
          .modify({ deletedAt: now, updatedAt: now });
      }
    }
  });

  return {
    success: true,
    message: `Link updated successfully`,
  };
}

/**
 * Delete a link (physical delete)
 */
export async function deleteLink(args: {
  id: string;
}): Promise<{ success: boolean; message: string }> {
  const existingLink = await db.links.get(args.id);
  if (!existingLink) {
    throw new Error(`链接不存在或已被删除`);
  }

  await db.transaction('rw', db.links, db.linkStats, getLinkTagsTable(), async () => {
    // Soft delete the link
    await db.links.update(args.id, { deletedAt: Date.now(), updatedAt: Date.now() });

    // Soft delete link tag associations
    const linkTags = await getLinkTagsTable().where('linkId').equals(args.id).toArray();
    for (const lt of linkTags) {
      await getLinkTagsTable().update([lt.linkId, lt.tagId], {
        deletedAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    // Physically delete link stats
    await db.linkStats.delete(args.id);
  });

  return {
    success: true,
    message: `Link "${existingLink.name}" deleted successfully`,
  };
}

/**
 * Toggle link pin status
 * @param args - Link ID
 */
export async function toggleLinkPin(args: {
  id: string;
}): Promise<{ success: boolean; message: string }> {
  const existingLink = await db.links.get(args.id);
  if (!existingLink) {
    throw new Error(`链接不存在或已被删除`);
  }

  const now = Date.now();
  const stat = await db.linkStats.get(args.id);
  const currentPinnedAt = stat?.pinnedAt;

  await db.transaction('rw', db.linkStats, async () => {
    if (currentPinnedAt) {
      // Unpin: remove pinnedAt
      await db.linkStats.update(args.id, { pinnedAt: undefined });
    } else {
      // Pin: set pinnedAt to current timestamp
      if (stat) {
        await db.linkStats.update(args.id, { pinnedAt: now });
      } else {
        // Create stat record if doesn't exist
        await db.linkStats.add({
          id: args.id,
          usageCount: 0,
          lastUsedAt: now,
          pinnedAt: now,
        });
      }
    }
  });

  return {
    success: true,
    message: currentPinnedAt ? `Link unpinned successfully` : `Link pinned successfully`,
  };
}

/**
 * Record link visit (increment usageCount, update lastUsedAt)
 * @param args - Link ID
 */
export async function recordLinkVisit(args: {
  id: string;
}): Promise<{ success: boolean; message: string }> {
  const existingLink = await db.links.get(args.id);
  if (!existingLink) {
    throw new Error(`链接不存在或已被删除`);
  }

  const now = Date.now();

  await db.transaction('rw', db.linkStats, async () => {
    const stat = await db.linkStats.get(args.id);
    if (stat) {
      await db.linkStats.update(args.id, {
        usageCount: (stat.usageCount || 0) + 1,
        lastUsedAt: now,
      });
    } else {
      // Create stat record if doesn't exist
      await db.linkStats.add({
        id: args.id,
        usageCount: 1,
        lastUsedAt: now,
      });
    }
  });

  return {
    success: true,
    message: `Link visit recorded`,
  };
}

/**
 * Bulk add links
 * @param args - Array of link data
 */
export async function bulkAddLinks(args: {
  links: Array<{ name: string; url: string; note?: string; tags?: string[] }>;
}): Promise<{ success: boolean; count: number; message: string }> {
  const now = Date.now();
  const results: Array<{ name: string; url: string; note?: string; tags?: string[] }> = [];

  for (const link of args.links) {
    // Validate URL format
    if (!isValidUrl(link.url)) {
      throw new Error(`URL "${link.url}" 格式不正确，请以 http:// 或 https:// 开头`);
    }

    const tagIds = link.tags ? await resolveTagNamesToIds(link.tags) : [];

    results.push({
      name: link.name,
      url: link.url,
      note: link.note,
      tags: tagIds,
    });
  }

  await db.transaction('rw', db.links, getLinkTagsTable(), async () => {
    for (const link of results) {
      const id = crypto.randomUUID();

      // Create link
      await db.links.add({
        id,
        name: link.name,
        url: link.url,
        note: link.note,
        category: '',
        createdAt: now,
        updatedAt: now,
      });

      // Add tags if provided
      if (link.tags && link.tags.length > 0) {
        for (const tagId of link.tags) {
          await getLinkTagsTable().add({
            linkId: id,
            tagId,
            updatedAt: now,
          });
        }
      }
    }
  });

  return {
    success: true,
    count: results.length,
    message: `Successfully added ${results.length} links`,
  };
}

/**
 * Get a single link by ID
 */
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

/**
 * Get a link by URL (used for recording link visits)
 */
export async function getLinkByUrl(url: string): Promise<LinkItem | null> {
  const link = await db.links.filter((l) => l.url === url && !l.deletedAt).first();
  return link || null;
}

/**
 * Get all active links (without soft deleted)
 */
export async function getAllActiveLinks(): Promise<LinkItem[]> {
  return db.links.filter((l) => !l.deletedAt).toArray();
}

/**
 * Get all active link tags
 */
export async function getAllActiveLinkTags(): Promise<LinkTagItem[]> {
  return db.linkTags.filter((lt) => !lt.deletedAt).toArray();
}

/**
 * Get all link stats
 */
export async function getAllLinkStats(): Promise<LinkStatItem[]> {
  return db.linkStats.toArray();
}
