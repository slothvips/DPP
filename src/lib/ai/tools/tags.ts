// Tags management AI tools
import { addTag, deleteTag, listTags, updateTag } from '@/lib/db';
import type { ToolHandler } from '../tools';
import { createToolParameter, toolRegistry } from '../tools';

/**
 * List all tags
 */
async function tags_list() {
  return listTags();
}

/**
 * Add a new tag
 */
async function tags_add(args: { name: string; color: string }) {
  return addTag(args);
}

/**
 * Update a tag
 */
async function tags_update(args: { id: string; name?: string; color?: string }) {
  return updateTag(args);
}

/**
 * Delete a tag
 */
async function tags_delete(args: { id: string }) {
  return deleteTag(args);
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

  // tags_update
  toolRegistry.register({
    name: 'tags_update',
    description: 'Update an existing tag (name or color)',
    parameters: createToolParameter(
      {
        id: { type: 'string', description: 'Tag ID to update' },
        name: { type: 'string', description: 'New tag name (optional)' },
        color: { type: 'string', description: 'New tag color (optional, hex like #FF5733)' },
      },
      ['id']
    ),
    handler: tags_update as ToolHandler,
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
