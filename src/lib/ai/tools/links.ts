// Links management AI tools
import type { Table } from 'dexie';
import { db } from '@/db';
import type { LinkTagItem } from '@/db/types';
import { openLink } from '@/features/links/utils';
import type { ToolHandler } from '../tools';
import { createToolParameter, toolRegistry } from '../tools';

// Cast linkTags table for transaction
const linkTagsTable = db.linkTags as unknown as Table<LinkTagItem, [string, string]>;

/**
 * List all links, optionally filtered by keyword and tags
 */
async function links_list(args: { keyword?: string; tags?: string[] }) {
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

  // Filter by tags if provided
  if (args.tags && args.tags.length > 0) {
    const linkTags = await db.linkTags
      .filter((lt) => !lt.deletedAt && args.tags!.includes(lt.tagId))
      .toArray();
    const linkIdsWithTags = new Set(linkTags.map((lt) => lt.linkId));
    links = links.filter((l) => linkIdsWithTags.has(l.id));
  }

  // Get tags for each link
  const linksWithTags = await Promise.all(
    links.map(async (link) => {
      const linkTagRecords = await db.linkTags
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
 */
async function links_add(args: { name: string; url: string; note?: string; tags?: string[] }) {
  const now = Date.now();
  const id = crypto.randomUUID();

  await db.transaction('rw', db.links, linkTagsTable, async () => {
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
    if (args.tags && args.tags.length > 0) {
      const tags = await db.tags.filter((t) => !t.deletedAt).toArray();
      const tagMap = new Map(tags.map((t) => [t.name.toLowerCase(), t.id]));

      for (const tagName of args.tags) {
        const tagId = tagMap.get(tagName.toLowerCase());
        if (tagId) {
          await db.linkTags.add({
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
    id,
    message: `Link "${args.name}" added successfully`,
  };
}

/**
 * Update an existing link
 */
async function links_update(args: {
  id: string;
  name?: string;
  url?: string;
  note?: string;
  tags?: string[];
}) {
  const existingLink = await db.links.get(args.id);
  if (!existingLink) {
    throw new Error(`Link with id ${args.id} not found`);
  }

  const now = Date.now();

  await db.transaction('rw', db.links, linkTagsTable, async () => {
    // Update link
    await db.links.update(args.id, {
      name: args.name ?? existingLink.name,
      url: args.url ?? existingLink.url,
      note: args.note ?? existingLink.note,
      updatedAt: now,
    });

    // Update tags if provided
    if (args.tags !== undefined) {
      // Remove existing tags
      await db.linkTags.where({ linkId: args.id }).modify({ deletedAt: now });

      // Add new tags
      if (args.tags.length > 0) {
        const tags = await db.tags.filter((t) => !t.deletedAt).toArray();
        const tagMap = new Map(tags.map((t) => [t.name.toLowerCase(), t.id]));

        for (const tagName of args.tags) {
          const tagId = tagMap.get(tagName.toLowerCase());
          if (tagId) {
            await db.linkTags.add({
              linkId: args.id,
              tagId,
              updatedAt: now,
            });
          }
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
 * Delete a link (soft delete)
 */
async function links_delete(args: { id: string }) {
  const existingLink = await db.links.get(args.id);
  if (!existingLink) {
    throw new Error(`Link with id ${args.id} not found`);
  }

  const now = Date.now();

  await db.transaction('rw', db.links, linkTagsTable, async () => {
    await db.links.update(args.id, { deletedAt: now });
    await db.linkTags.where({ linkId: args.id }).modify({ deletedAt: now });
  });

  return {
    success: true,
    message: `Link "${existingLink.name}" deleted successfully`,
  };
}

/**
 * Visit a link and record statistics
 */
async function links_visit(args: { id: string }) {
  const link = await db.links.get(args.id);
  if (!link) {
    throw new Error(`Link with id ${args.id} not found`);
  }

  await openLink(link.url);

  return {
    success: true,
    message: `Opening "${link.name}" in new tab`,
    url: link.url,
  };
}

/**
 * Register all links tools
 */
export function registerLinksTools() {
  // links_list
  toolRegistry.register({
    name: 'links_list',
    description: 'List all links, supports keyword and tag filtering',
    parameters: createToolParameter(
      {
        keyword: {
          type: 'string',
          description: 'Keyword to filter links by name, URL, or note',
        },
        tags: {
          type: 'array',
          description: 'Tag names to filter links',
        },
      },
      []
    ),
    handler: links_list as ToolHandler,
  });

  // links_add
  toolRegistry.register({
    name: 'links_add',
    description: 'Add a new link with name, URL, note, and tags',
    parameters: createToolParameter(
      {
        name: { type: 'string', description: 'Link name' },
        url: { type: 'string', description: 'Link URL' },
        note: { type: 'string', description: 'Optional note for the link' },
        tags: {
          type: 'array',
          description: 'Tag names to assign to the link',
        },
      },
      ['name', 'url']
    ),
    handler: links_add as ToolHandler,
  });

  // links_update
  toolRegistry.register({
    name: 'links_update',
    description: 'Update an existing link',
    parameters: createToolParameter(
      {
        id: { type: 'string', description: 'Link ID to update' },
        name: { type: 'string', description: 'New name (optional)' },
        url: { type: 'string', description: 'New URL (optional)' },
        note: { type: 'string', description: 'New note (optional)' },
        tags: {
          type: 'array',
          description: 'New tag names to assign (optional)',
        },
      },
      ['id']
    ),
    handler: links_update as ToolHandler,
  });

  // links_delete (requires confirmation)
  toolRegistry.register({
    name: 'links_delete',
    description: 'Delete a link (soft delete)',
    parameters: createToolParameter(
      {
        id: { type: 'string', description: 'Link ID to delete' },
      },
      ['id']
    ),
    handler: links_delete as ToolHandler,
    requiresConfirmation: true,
  });

  // links_visit
  toolRegistry.register({
    name: 'links_visit',
    description: 'Visit a link in a new tab and record statistics',
    parameters: createToolParameter(
      {
        id: { type: 'string', description: 'Link ID to visit' },
      },
      ['id']
    ),
    handler: links_visit as ToolHandler,
  });
}
