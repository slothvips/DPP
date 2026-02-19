// Blackboard (便签) management AI tools
import {
  addBlackboard,
  deleteBlackboard,
  listBlackboard,
  toggleBlackboardPin,
  updateBlackboard,
} from '@/lib/db';
import type { ToolHandler } from '../tools';
import { createToolParameter, toolRegistry } from '../tools';

/**
 * List all blackboard items
 */
async function blackboard_list() {
  return listBlackboard();
}

/**
 * Add a new blackboard item
 */
async function blackboard_add(args: { content: string; pinned?: boolean }) {
  return addBlackboard(args);
}

/**
 * Update a blackboard item
 */
async function blackboard_update(args: { id: string; content?: string; pinned?: boolean }) {
  return updateBlackboard(args);
}

/**
 * Delete a blackboard item
 */
async function blackboard_delete(args: { id: string }) {
  return deleteBlackboard(args);
}

/**
 * Toggle pin status of a blackboard item
 */
async function blackboard_togglePin(args: { id: string }) {
  return toggleBlackboardPin(args);
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

  // blackboard_togglePin
  toolRegistry.register({
    name: 'blackboard_togglePin',
    description: 'Toggle pin status of a blackboard item (便签)',
    parameters: createToolParameter(
      {
        id: { type: 'string', description: 'The item ID to toggle pin status' },
      },
      ['id']
    ),
    handler: blackboard_togglePin as ToolHandler,
  });
}
