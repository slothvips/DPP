// Blackboard 管理 AI 工具
import {
  addBlackboard,
  deleteBlackboard,
  listBlackboard,
  toggleBlackboardLock,
  toggleBlackboardPin,
  updateBlackboard,
} from '@/lib/db';
import type { ToolHandler } from '../tools';
import { createToolParameter, toolRegistry } from '../tools';

/**
 * List all blackboard items
 */
async function blackboard_list(args: { page?: number; pageSize?: number }) {
  return listBlackboard(args);
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
async function blackboard_update(args: {
  id: string;
  content?: string;
  pinned?: boolean;
  locked?: boolean;
}) {
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
 * Toggle lock status of a blackboard item
 */
async function blackboard_toggleLock(args: { id: string }) {
  return toggleBlackboardLock(args);
}

/**
 * Register all blackboard tools
 */
export function registerBlackboardTools() {
  // blackboard_list
  toolRegistry.register({
    name: 'blackboard_list',
    description: '列出所有黑板内容（口语里的「便签」即黑板内容）',
    parameters: createToolParameter(
      {
        page: { type: 'integer', minimum: 1, description: '页码，默认 1' },
        pageSize: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          description: '每页数量，默认 20，最大 100',
        },
      },
      []
    ),
    handler: blackboard_list as ToolHandler,
  });

  // blackboard_add (requires confirmation)
  toolRegistry.register({
    name: 'blackboard_add',
    description: '新增一条黑板内容',
    parameters: createToolParameter(
      {
        content: {
          type: 'string',
          description: '黑板内容，支持 Markdown',
        },
        pinned: { type: 'boolean', description: '是否置顶，可选' },
      },
      ['content']
    ),
    handler: blackboard_add as ToolHandler,
    requiresConfirmation: true,
  });

  // blackboard_update (requires confirmation)
  toolRegistry.register({
    name: 'blackboard_update',
    description: '更新一条黑板内容',
    parameters: createToolParameter(
      {
        id: { type: 'string', description: '要更新的黑板内容 ID' },
        content: { type: 'string', description: '新的黑板内容，可选，支持 Markdown' },
        pinned: { type: 'boolean', description: '是否置顶，可选' },
        locked: { type: 'boolean', description: '是否锁定此黑板内容，可选' },
      },
      ['id']
    ),
    handler: blackboard_update as ToolHandler,
    requiresConfirmation: true,
  });

  // blackboard_delete (requires confirmation)
  toolRegistry.register({
    name: 'blackboard_delete',
    description: '删除一条黑板内容',
    parameters: createToolParameter(
      {
        id: { type: 'string', description: '要删除的黑板内容 ID' },
      },
      ['id']
    ),
    handler: blackboard_delete as ToolHandler,
    requiresConfirmation: true,
  });

  // blackboard_togglePin
  toolRegistry.register({
    name: 'blackboard_togglePin',
    description: '切换黑板内容的置顶状态',
    parameters: createToolParameter(
      {
        id: { type: 'string', description: '要切换置顶状态的黑板内容 ID' },
      },
      ['id']
    ),
    handler: blackboard_togglePin as ToolHandler,
    requiresConfirmation: true,
  });

  // blackboard_toggleLock
  toolRegistry.register({
    name: 'blackboard_toggleLock',
    description: '切换黑板内容的锁定状态',
    parameters: createToolParameter(
      {
        id: { type: 'string', description: '要切换锁定状态的黑板内容 ID' },
      },
      ['id']
    ),
    handler: blackboard_toggleLock as ToolHandler,
    requiresConfirmation: true,
  });
}
