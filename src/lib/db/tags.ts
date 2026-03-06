// Unified tags database operations
import type { Table } from 'dexie';
import { db } from '@/db';
import type { JobTagItem, LinkTagItem, TagItem, TagWithCounts } from '@/db/types';

// Lazy getters to avoid "Cannot access 'db' before initialization" error
function getLinkTagsTable(): Table<LinkTagItem, [string, string]> {
  return db.linkTags as unknown as Table<LinkTagItem, [string, string]>;
}

function getJobTagsTable(): Table<JobTagItem, [string, string]> {
  return db.jobTags as unknown as Table<JobTagItem, [string, string]>;
}

/**
 * List all active tags
 */
export async function getAllActiveTags(): Promise<TagItem[]> {
  return db.tags.filter((t) => !t.deletedAt).toArray();
}

/**
 * Get active tag IDs for an entity
 */
export async function getActiveEntityTagIds(
  entityId: string,
  entityType: 'link' | 'job'
): Promise<string[]> {
  if (!entityId) return [];

  if (entityType === 'link') {
    const linkTags = await db.linkTags
      .where('linkId')
      .equals(entityId)
      .filter((item) => !item.deletedAt)
      .toArray();
    return linkTags.map((lt) => lt.tagId);
  }

  const jobTags = await db.jobTags
    .where('jobUrl')
    .equals(entityId)
    .filter((item) => !item.deletedAt)
    .toArray();
  return jobTags.map((jt) => jt.tagId);
}

/**
 * List all tags
 */
export async function listTags(): Promise<{
  total: number;
  tags: TagWithCounts[];
}> {
  const tags = await db.tags.filter((t) => !t.deletedAt).toArray();

  // Get link counts for each tag
  const tagsWithCounts = await Promise.all(
    tags.map(async (tag) => {
      const linkTags = await db.linkTags
        .filter((lt) => !lt.deletedAt && lt.tagId === tag.id)
        .toArray();
      const jobTags = await db.jobTags
        .filter((jt) => !jt.deletedAt && jt.tagId === tag.id)
        .toArray();

      return {
        id: tag.id,
        name: tag.name,
        color: tag.color,
        linkCount: linkTags.length,
        jobCount: jobTags.length,
        createdAt: tag.updatedAt,
        updatedAt: tag.updatedAt,
      };
    })
  );

  return {
    total: tags.length,
    tags: tagsWithCounts,
  };
}

/**
 * Add a new tag
 */
export async function addTag(args: {
  name: string;
  color?: string;
}): Promise<{ success: boolean; id: string; message: string }> {
  const now = Date.now();
  const id = crypto.randomUUID();

  // Check if tag already exists
  const existing = await db.tags
    .filter((t) => !t.deletedAt && t.name.toLowerCase() === args.name.toLowerCase())
    .first();
  if (existing) {
    throw new Error(`标签 "${args.name}" 已存在`);
  }

  // Generate random color if not provided
  const color =
    args.color ??
    `#${Math.floor(Math.random() * 16777215)
      .toString(16)
      .padStart(6, '0')}`;

  await db.tags.add({
    id,
    name: args.name,
    color,
    updatedAt: now,
  });

  return {
    success: true,
    id,
    message: `Tag "${args.name}" created successfully`,
  };
}

/**
 * Ensure tags exist (create if missing, reactivate if deleted)
 */
export async function ensureTagsExist(names: string[]): Promise<Map<string, string>> {
  if (names.length === 0) return new Map();

  const tagMap = new Map<string, string>();
  const now = Date.now();

  await db.transaction('rw', db.tags, async () => {
    for (const name of names) {
      if (!name || name.trim() === '') continue;
      const trimmedName = name.trim();

      const existing = await db.tags.where('name').equals(trimmedName).first();

      if (existing) {
        if (existing.deletedAt) {
          await db.tags.update(existing.id, { deletedAt: undefined, updatedAt: now });
        }
        tagMap.set(trimmedName, existing.id);
      } else {
        const newId = crypto.randomUUID();
        await db.tags.add({
          id: newId,
          name: trimmedName,
          color: 'blue',
          updatedAt: now,
        });
        tagMap.set(trimmedName, newId);
      }
    }
  });

  return tagMap;
}

/**
 * Create a new tag or reactivate an existing one by name
 */
export async function createOrReactivateTag(args: {
  name: string;
}): Promise<{ success: boolean; id: string; message: string; isExisting: boolean }> {
  const trimmedName = args.name.trim();
  const existing = await db.tags.where('name').equals(trimmedName).first();
  const now = Date.now();

  if (existing) {
    if (existing.deletedAt) {
      await db.tags.update(existing.id, { deletedAt: undefined, updatedAt: now });
    }
    return {
      success: true,
      id: existing.id,
      message: existing.deletedAt
        ? `Tag "${trimmedName}" reactivated`
        : `Tag "${trimmedName}" already exists`,
      isExisting: true,
    };
  }

  const newId = crypto.randomUUID();
  await db.tags.add({
    id: newId,
    name: trimmedName,
    color: 'blue',
    updatedAt: now,
  });

  return {
    success: true,
    id: newId,
    message: `Tag "${trimmedName}" created successfully`,
    isExisting: false,
  };
}

/**
 * Update a tag
 */
export async function updateTag(args: {
  id: string;
  name?: string;
  color?: string;
}): Promise<{ success: boolean; message: string }> {
  const existing = await db.tags.get(args.id);
  if (!existing) {
    throw new Error(`标签不存在或已被删除`);
  }

  // Check if new name already exists (if name is being changed)
  if (args.name && args.name.toLowerCase() !== existing.name.toLowerCase()) {
    const duplicate = await db.tags
      .filter((t) => !t.deletedAt && t.name.toLowerCase() === args.name!.toLowerCase())
      .first();
    if (duplicate) {
      throw new Error(`标签 "${args.name}" 已存在`);
    }
  }

  await db.tags.update(args.id, {
    name: args.name ?? existing.name,
    color: args.color ?? existing.color,
    updatedAt: Date.now(),
  });

  return {
    success: true,
    message: `Tag updated successfully`,
  };
}

/**
 * Delete a tag (soft delete)
 */
export async function deleteTag(args: {
  id: string;
}): Promise<{ success: boolean; message: string }> {
  const existing = await db.tags.get(args.id);
  if (!existing) {
    throw new Error(`标签不存在或已被删除`);
  }

  const now = Date.now();

  await db.transaction('rw', db.tags, getLinkTagsTable(), getJobTagsTable(), async () => {
    // Soft delete the tag
    await db.tags.update(args.id, { deletedAt: now });

    // Soft delete all link associations
    await db.linkTags.where({ tagId: args.id }).modify({ deletedAt: now });

    // Soft delete all job associations
    await db.jobTags.where({ tagId: args.id }).modify({ deletedAt: now });
  });

  return {
    success: true,
    message: `Tag "${existing.name}" deleted successfully`,
  };
}

/**
 * Check if a tag is in use
 */
export async function getTagUsageCount(tagId: string): Promise<number> {
  const jobCount = await db.jobTags
    .where('tagId')
    .equals(tagId)
    .filter((jt) => !jt.deletedAt)
    .count();

  const linkCount = await db.linkTags
    .where('tagId')
    .equals(tagId)
    .filter((lt) => !lt.deletedAt)
    .count();

  return jobCount + linkCount;
}

/**
 * Toggle tag association with a link or job
 */
export async function toggleTagAssociation(args: {
  tagId: string;
  entityId: string;
  entityType: 'link' | 'job';
}): Promise<{ success: boolean; message: string }> {
  // Check if tag exists
  const tag = await db.tags.get(args.tagId);
  if (!tag || tag.deletedAt) {
    throw new Error('标签不存在或已被删除');
  }

  const now = Date.now();

  if (args.entityType === 'link') {
    // Check if link exists
    const link = await db.links.get(args.entityId);
    if (!link || link.deletedAt) {
      throw new Error('链接不存在或已被删除');
    }

    // Check if association exists
    const existingAssociation = await db.linkTags
      .filter((lt) => !lt.deletedAt && lt.tagId === args.tagId && lt.linkId === args.entityId)
      .first();

    if (existingAssociation) {
      // Remove association (soft delete) - use compound key
      await db.linkTags
        .where({ linkId: args.entityId, tagId: args.tagId })
        .modify({ deletedAt: now });
      return {
        success: true,
        message: `Tag "${tag.name}" removed from link`,
      };
    } else {
      // Create association - no id needed, compound key
      await db.linkTags.add({
        tagId: args.tagId,
        linkId: args.entityId,
        updatedAt: now,
      });
      return {
        success: true,
        message: `Tag "${tag.name}" added to link`,
      };
    }
  } else {
    // entityType === 'job' - use jobUrl as key
    // Check if job exists
    const job = await db.jobs.get(args.entityId);
    if (!job) {
      throw new Error('任务不存在或已被删除');
    }

    // Check if association exists - use jobUrl instead of jobId
    const existingAssociation = await db.jobTags
      .filter((jt) => !jt.deletedAt && jt.tagId === args.tagId && jt.jobUrl === args.entityId)
      .first();

    if (existingAssociation) {
      // Remove association (soft delete) - use compound key
      await db.jobTags
        .where({ jobUrl: args.entityId, tagId: args.tagId })
        .modify({ deletedAt: now });
      return {
        success: true,
        message: `Tag "${tag.name}" removed from job`,
      };
    } else {
      // Create association - use jobUrl instead of jobId, no id needed
      await db.jobTags.add({
        tagId: args.tagId,
        jobUrl: args.entityId,
        updatedAt: now,
      });
      return {
        success: true,
        message: `Tag "${tag.name}" added to job`,
      };
    }
  }
}
