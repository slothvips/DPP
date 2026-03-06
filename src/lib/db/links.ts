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
 * List all links, optionally filtered by keyword and tags
 */
export async function listLinks(args: { keyword?: string; tags?: string[] }): Promise<{
  total: number;
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
  let links = await db.links.filter((l) => !l.deletedAt).toArray();

  // Filter by keyword
  if (args.keyword) {
    const keyword = args.keyword.toLowerCase();
    links = links.filter(
      (l) =>
        l.name.toLowerCase().includes(keyword) ||
        l.url.toLowerCase().includes(keyword) ||
        (l.note && l.note.toLowerCase().includes(keyword))
    );
  }

  // Filter by tags if provided (supports both tag names and tag IDs)
  if (args.tags && args.tags.length > 0) {
    // Check if tags are IDs or names
    const allTags = await db.tags.filter((t) => !t.deletedAt).toArray();
    const tagNameToId = new Map(allTags.map((t) => [t.name.toLowerCase(), t.id]));
    const tagIdSet = new Set(
      args.tags.map((t) =>
        tagNameToId.has(t.toLowerCase()) ? tagNameToId.get(t.toLowerCase())! : t
      )
    );

    const linkTags = await getLinkTagsTable()
      .filter((lt) => !lt.deletedAt && tagIdSet.has(lt.tagId))
      .toArray();
    const linkIdsWithTags = new Set(linkTags.map((lt) => lt.linkId));
    links = links.filter((l) => linkIdsWithTags.has(l.id));
  }

  // Get tags for each link
  const linksWithTags = await Promise.all(
    links.map(async (link) => {
      const linkTagRecords = await getLinkTagsTable()
        .filter((lt) => !lt.deletedAt && lt.linkId === link.id)
        .toArray();
      const tagIds = linkTagRecords.map((lt) => lt.tagId);
      const tags = await db.tags.filter((t) => !t.deletedAt && tagIds.includes(t.id)).toArray();

      // Get usage stats
      const stat = await db.linkStats.get(link.id);

      return {
        id: link.id,
        name: link.name,
        url: link.url,
        note: link.note,
        tags: tags.map((t) => ({ id: t.id, name: t.name, color: t.color })),
        usageCount: stat?.usageCount || 0,
        lastUsedAt: stat?.lastUsedAt,
        createdAt: link.createdAt,
        updatedAt: link.updatedAt,
      };
    })
  );

  return {
    total: linksWithTags.length,
    links: linksWithTags,
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

  // Validate URL format if provided
  if (args.url && !isValidUrl(args.url)) {
    throw new Error(`URL 格式不正确，请以 http:// 或 https:// 开头`);
  }

  const now = Date.now();

  // Resolve tag names to IDs if needed
  const newTagIds = args.tags ? await resolveTagNamesToIds(args.tags) : undefined;

  await db.transaction('rw', db.links, getLinkTagsTable(), async () => {
    // Update link
    await db.links.update(args.id, {
      name: args.name ?? existingLink.name,
      url: args.url ?? existingLink.url,
      note: args.note ?? existingLink.note,
      updatedAt: now,
    });

    // Update tags if provided - use smart update logic (restore deleted tags)
    if (newTagIds !== undefined) {
      const existingLinkTags = await getLinkTagsTable().where('linkId').equals(args.id).toArray();
      const existingTagIds = new Set(
        existingLinkTags.filter((lt) => !lt.deletedAt).map((lt) => lt.tagId)
      );
      const tagIdSet = new Set(newTagIds);

      // Add new tags or restore deleted ones
      for (const tagId of newTagIds) {
        if (!existingTagIds.has(tagId)) {
          const deletedTag = existingLinkTags.find((lt) => lt.tagId === tagId && lt.deletedAt);
          if (deletedTag) {
            // Restore deleted tag association
            await getLinkTagsTable().put({ ...deletedTag, deletedAt: undefined, updatedAt: now });
          } else {
            // Add new tag association
            await getLinkTagsTable().add({ linkId: args.id, tagId, updatedAt: now });
          }
        }
      }

      // Remove tags that are no longer associated
      for (const existingId of existingTagIds) {
        if (!tagIdSet.has(existingId)) {
          await getLinkTagsTable()
            .where({ linkId: args.id, tagId: existingId })
            .modify({ deletedAt: now, updatedAt: now });
        }
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
