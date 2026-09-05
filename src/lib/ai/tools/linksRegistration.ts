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
    description: '分页列出所有链接，返回总数、当前页和用于继续分页的 hasMore 标记。',
    parameters: createToolParameter(
      {
        keyword: {
          type: 'string',
          description: '按链接名称、URL 或备注筛选链接的关键词',
        },
        tags: {
          type: 'array',
          description: '用于筛选链接的标签名称',
        },
        page: {
          type: 'integer',
          minimum: 1,
          description: '页码，从 1 开始，默认 1',
        },
        pageSize: {
          type: 'integer',
          minimum: 1,
          description: '每页数量，默认 20；建议使用 10-20，避免占用过多上下文',
        },
      },
      []
    ),
    handler: links_list as ToolHandler,
  });

  toolRegistry.register({
    name: 'links_add',
    description: '添加带有名称、URL、备注和标签的新链接',
    parameters: createToolParameter(
      {
        name: { type: 'string', description: '链接名称' },
        url: { type: 'string', description: '链接 URL' },
        note: { type: 'string', description: '链接备注，可选' },
        tags: {
          type: 'array',
          description:
            'Tag names to associate. Call tags_list first and reuse an existing tag whenever possible. Do not create a new tag for convenience; if no suitable tag exists, ask the user unless they explicitly request a new one.',
        },
      },
      ['name', 'url']
    ),
    handler: links_add as ToolHandler,
    requiresConfirmation: true,
  });

  toolRegistry.register({
    name: 'links_update',
    description: '更新已有链接',
    parameters: createToolParameter(
      {
        id: { type: 'string', description: '要更新的链接 ID' },
        name: { type: 'string', description: '新的名称，可选' },
        url: { type: 'string', description: '新的 URL，可选' },
        note: { type: 'string', description: '新的备注，可选' },
        tags: {
          type: 'array',
          description:
            'Tag names to associate. Reuse an existing tag returned by tags_list whenever possible. Do not create a new tag for convenience; if no suitable tag exists, ask the user unless they explicitly request a new one.',
        },
      },
      ['id']
    ),
    handler: links_update as ToolHandler,
    requiresConfirmation: true,
  });

  toolRegistry.register({
    name: 'links_delete',
    description: '删除链接（软删除）',
    parameters: createToolParameter(
      {
        id: { type: 'string', description: '要删除的链接 ID' },
      },
      ['id']
    ),
    handler: links_delete as ToolHandler,
    requiresConfirmation: true,
  });

  toolRegistry.register({
    name: 'links_visit',
    description: '在新标签页中访问链接并记录统计信息',
    parameters: createToolParameter(
      {
        id: { type: 'string', description: '要访问的链接 ID' },
      },
      ['id']
    ),
    handler: links_visit as ToolHandler,
  });

  toolRegistry.register({
    name: 'links_togglePin',
    description: '切换链接的置顶状态（置顶或取消置顶）',
    parameters: createToolParameter(
      {
        id: { type: 'string', description: '要切换置顶状态的链接 ID' },
      },
      ['id']
    ),
    handler: links_togglePin as ToolHandler,
    requiresConfirmation: true,
  });

  toolRegistry.register({
    name: 'links_recordVisit',
    description: '记录一次链接访问（增加使用次数并更新上次使用时间）',
    parameters: createToolParameter(
      {
        id: { type: 'string', description: '要记录访问的链接 ID' },
      },
      ['id']
    ),
    handler: links_recordVisit as ToolHandler,
  });

  toolRegistry.register({
    name: 'links_bulkAdd',
    description:
      '一次批量添加多个链接。用户希望导入、批量创建或整理一组链接到 DPP 时优先使用此工具。',
    parameters: createToolParameter(
      {
        links: {
          type: 'array',
          description:
            '要添加的链接数组，每项包含 name、url，以及可选的 note 和 tags。先调用 tags_list 并复用已有标签；除非用户明确要求，否则不要创建新标签。',
        },
      },
      ['links']
    ),
    handler: links_bulkAdd as ToolHandler,
    requiresConfirmation: true,
  });
}
