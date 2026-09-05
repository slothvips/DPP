// Tags management AI tools
import {
  createOrReactivateTag,
  deleteTag,
  listTags,
  toggleTagAssociation,
  updateTag,
} from '@/lib/db';
import type { ToolHandler } from '../tools';
import { createToolParameter, toolRegistry } from '../tools';

/**
 * List all tags
 */
async function tags_list(args: { page?: number; pageSize?: number }) {
  return listTags(args);
}

/**
 * Add a new tag
 */
async function tags_add(args: { name: string; color?: string }) {
  return createOrReactivateTag(args);
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
 * Toggle tag association with a link or job
 */
async function tags_toggle(args: { tagId: string; entityId: string; entityType: 'link' | 'job' }) {
  return toggleTagAssociation(args);
}

/**
 * Register all tags tools
 */
export function registerTagsTools() {
  // tags_list
  toolRegistry.register({
    name: 'tags_list',
    description: '分页列出标签，并返回每个标签关联的链接和任务数量',
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
    handler: tags_list as ToolHandler,
  });

  // tags_add (requires confirmation)
  toolRegistry.register({
    name: 'tags_add',
    description:
      'Create a new tag only when the user explicitly requests it and no suitable existing tag can be reused. Repeated or matching names are reused or reactivated instead of creating duplicates.',
    parameters: createToolParameter(
      {
        name: { type: 'string', description: '标签名称' },
        color: { type: 'string', description: '标签颜色，可选十六进制颜色值，例如 #FF5733' },
      },
      ['name']
    ),
    handler: tags_add as ToolHandler,
    requiresConfirmation: true,
  });

  // tags_update (requires confirmation)
  toolRegistry.register({
    name: 'tags_update',
    description: '更新已有标签的名称或颜色',
    parameters: createToolParameter(
      {
        id: { type: 'string', description: '要更新的标签 ID' },
        name: { type: 'string', description: '新的标签名称，可选' },
        color: {
          type: 'string',
          description: '新的标签颜色，可选，使用十六进制颜色值，例如 #FF5733',
        },
      },
      ['id']
    ),
    handler: tags_update as ToolHandler,
    requiresConfirmation: true,
  });

  // tags_delete (requires confirmation)
  toolRegistry.register({
    name: 'tags_delete',
    description: '删除标签，并从所有链接和任务中移除关联',
    parameters: createToolParameter(
      {
        id: { type: 'string', description: '要删除的标签 ID' },
      },
      ['id']
    ),
    handler: tags_delete as ToolHandler,
    requiresConfirmation: true,
  });

  // tags_toggle (requires confirmation)
  toolRegistry.register({
    name: 'tags_toggle',
    description: '切换标签与链接或任务的关联状态',
    parameters: createToolParameter(
      {
        tagId: { type: 'string', description: '要切换关联状态的标签 ID' },
        entityId: { type: 'string', description: '要关联或取消关联的链接或任务 ID' },
        entityType: { type: 'string', description: '实体类型："link" 或 "job"' },
      },
      ['tagId', 'entityId', 'entityType']
    ),
    handler: tags_toggle as ToolHandler,
    requiresConfirmation: true,
  });
}
