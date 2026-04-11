import type { ToolHandler } from '../tools';
import { createToolParameter, toolRegistry } from '../tools';
import {
  links_add,
  links_bulkAdd,
  links_delete,
  links_list,
  links_recordVisit,
  links_togglePin,
  links_update,
  links_visit,
} from './linksHandlers';

export function registerLinksTools() {
  toolRegistry.register({
    name: 'links_list',
    description:
      'List all links with pagination support. Returns total count, current page, and hasMore flag for pagination.',
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
        page: {
          type: 'number',
          description: 'Page number (starting from 1). Default: 1',
        },
        pageSize: {
          type: 'number',
          description:
            'Number of items per page. Default: 20. Recommended: 10-20 to avoid overwhelming the context',
        },
      },
      []
    ),
    handler: links_list as ToolHandler,
  });

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
    requiresConfirmation: true,
  });

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
    requiresConfirmation: true,
  });

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

  toolRegistry.register({
    name: 'links_togglePin',
    description: 'Toggle link pin status (pin or unpin a link)',
    parameters: createToolParameter(
      {
        id: { type: 'string', description: 'Link ID to toggle pin status' },
      },
      ['id']
    ),
    handler: links_togglePin as ToolHandler,
    requiresConfirmation: true,
  });

  toolRegistry.register({
    name: 'links_recordVisit',
    description: 'Record a link visit (increment usage count and update last used time)',
    parameters: createToolParameter(
      {
        id: { type: 'string', description: 'Link ID to record visit' },
      },
      ['id']
    ),
    handler: links_recordVisit as ToolHandler,
  });

  toolRegistry.register({
    name: 'links_bulkAdd',
    description:
      'Bulk add multiple links at once. Prefer this tool when the user wants to import, batch create, or整理一组链接到 DPP。',
    parameters: createToolParameter(
      {
        links: {
          type: 'array',
          description: 'Array of links to add, each with name, url, optional note and tags',
        },
      },
      ['links']
    ),
    handler: links_bulkAdd as ToolHandler,
    requiresConfirmation: true,
  });
}
