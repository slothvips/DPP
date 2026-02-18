// Blackboard (便签) management AI tools
import { db } from '@/db';
import { createToolParameter, toolRegistry } from '../tools';
import type { ToolHandler } from '../tools';

/**
 * List all blackboard items
 */
async function blackboard_list() {
  const items = await db.blackboard.orderBy('pinned').reverse().sortBy('createdAt');

  return {
    total: items.length,
    items: items.map((item) => ({
      id: item.id,
      content: item.content,
      pinned: item.pinned || false,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })),
  };
}

/**
 * Add a new blackboard item
 */
async function blackboard_add(args: { content: string; pinned?: boolean }) {
  const now = Date.now();
  const id = crypto.randomUUID();

  await db.blackboard.add({
    id,
    content: args.content,
    createdAt: now,
    updatedAt: now,
    pinned: args.pinned || false,
  });

  return {
    success: true,
    id,
    message: 'Blackboard item added successfully',
  };
}

/**
 * Update a blackboard item
 */
async function blackboard_update(args: { id: string; content?: string; pinned?: boolean }) {
  const existing = await db.blackboard.get(args.id);
  if (!existing) {
    throw new Error(`Blackboard item not found: ${args.id}`);
  }

  await db.blackboard.update(args.id, {
    content: args.content ?? existing.content,
    pinned: args.pinned ?? existing.pinned,
    updatedAt: Date.now(),
  });

  return {
    success: true,
    message: 'Blackboard item updated successfully',
  };
}

/**
 * Delete a blackboard item
 */
async function blackboard_delete(args: { id: string }) {
  const existing = await db.blackboard.get(args.id);
  if (!existing) {
    throw new Error(`Blackboard item not found: ${args.id}`);
  }

  await db.blackboard.delete(args.id);

  return {
    success: true,
    message: 'Blackboard item deleted successfully',
  };
}

/**
 * Register all blackboard tools
 */
export function registerBlackboardTools() {
  // blackboard_list
  toolRegistry.register({
    name: 'blackboard_list',
    description: 'List all blackboard items (便签)',
    parameters: createToolParameter({}, []),
    handler: blackboard_list as ToolHandler,
  });

  // blackboard_add
  toolRegistry.register({
    name: 'blackboard_add',
    description: 'Add a new blackboard item (便签)',
    parameters: createToolParameter(
      {
        content: {
          type: 'string',
          description: 'The content of the blackboard item (supports markdown)',
        },
        pinned: { type: 'boolean', description: 'Whether to pin this item to top (optional)' },
      },
      ['content']
    ),
    handler: blackboard_add as ToolHandler,
  });

  // blackboard_update
  toolRegistry.register({
    name: 'blackboard_update',
    description: 'Update a blackboard item (便签)',
    parameters: createToolParameter(
      {
        id: { type: 'string', description: 'The item ID to update' },
        content: { type: 'string', description: 'New content (optional, supports markdown)' },
        pinned: { type: 'boolean', description: 'Whether to pin to top (optional)' },
      },
      ['id']
    ),
    handler: blackboard_update as ToolHandler,
  });

  // blackboard_delete (requires confirmation)
  toolRegistry.register({
    name: 'blackboard_delete',
    description: 'Delete a blackboard item (便签)',
    parameters: createToolParameter(
      {
        id: { type: 'string', description: 'The item ID to delete' },
      },
      ['id']
    ),
    handler: blackboard_delete as ToolHandler,
    requiresConfirmation: true,
  });
}
