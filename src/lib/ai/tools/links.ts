// Links management AI tools
import { db } from '@/db';
import { openLink } from '@/features/links/utils';
import { addLink, deleteLink, listLinks, updateLink } from '@/lib/db';
import type { ToolHandler } from '../tools';
import { createToolParameter, toolRegistry } from '../tools';

/**
 * List all links, optionally filtered by keyword and tags
 */
async function links_list(args: { keyword?: string; tags?: string[] }) {
  return listLinks(args);
}

/**
 * Add a new link
 */
async function links_add(args: { name: string; url: string; note?: string; tags?: string[] }) {
  return addLink(args);
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
  return updateLink(args);
}

/**
 * Delete a link
 */
async function links_delete(args: { id: string }) {
  return deleteLink(args);
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
          description:
            'IMPORTANT: Tag names must already exist. The system associates links to tags via tag IDs internally. If the tag does not exist, it will be skipped. Always call tags_add first if the tag does not exist.',
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
          description:
            'IMPORTANT: Tag names must already exist. If tag does not exist, it will be skipped. To add a new tag, first call tags_add.',
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
