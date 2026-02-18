// Tags management AI tools
import type { Table } from 'dexie';
import { db } from '@/db';
import type { JobTagItem, LinkTagItem } from '@/db/types';
import { createToolParameter, toolRegistry } from '../tools';
import type { ToolHandler } from '../tools';

// Cast tables for transaction
const linkTagsTable = db.linkTags as unknown as Table<LinkTagItem, [string, string]>;
const jobTagsTable = db.jobTags as unknown as Table<JobTagItem, [string, string]>;

/**
 * List all tags
 */
async function tags_list() {
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
async function tags_add(args: { name: string; color: string }) {
  const now = Date.now();
  const id = crypto.randomUUID();

  // Check if tag already exists
  const existing = await db.tags
    .filter((t) => !t.deletedAt && t.name.toLowerCase() === args.name.toLowerCase())
    .first();
  if (existing) {
    throw new Error(`Tag "${args.name}" already exists`);
  }

  await db.tags.add({
    id,
    name: args.name,
    color: args.color,
    updatedAt: now,
  });

  return {
    success: true,
    id,
    message: `Tag "${args.name}" created successfully`,
  };
}

/**
 * Delete a tag (soft delete)
 */
async function tags_delete(args: { id: string }) {
  const existing = await db.tags.get(args.id);
  if (!existing) {
    throw new Error(`Tag not found: ${args.id}`);
  }

  const now = Date.now();

  await db.transaction('rw', db.tags, linkTagsTable, jobTagsTable, async () => {
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
 * Register all tags tools
 */
export function registerTagsTools() {
  // tags_list
  toolRegistry.register({
    name: 'tags_list',
    description: 'List all tags with link and job counts',
    parameters: createToolParameter({}, []),
    handler: tags_list as ToolHandler,
  });

  // tags_add
  toolRegistry.register({
    name: 'tags_add',
    description: 'Create a new tag',
    parameters: createToolParameter(
      {
        name: { type: 'string', description: 'Tag name' },
        color: { type: 'string', description: 'Tag color (hex color like #FF5733)' },
      },
      ['name', 'color']
    ),
    handler: tags_add as ToolHandler,
  });

  // tags_delete (requires confirmation)
  toolRegistry.register({
    name: 'tags_delete',
    description: 'Delete a tag (removes from all links and jobs)',
    parameters: createToolParameter(
      {
        id: { type: 'string', description: 'Tag ID to delete' },
      },
      ['id']
    ),
    handler: tags_delete as ToolHandler,
    requiresConfirmation: true,
  });
}
