import { createToolParameter, toolRegistry } from '../tools';
import type { ToolHandler } from '../tools';
import {
  recorder_clear,
  recorder_delete,
  recorder_export,
  recorder_import,
  recorder_list,
  recorder_start,
  recorder_stop,
  recorder_updateTitle,
} from './recorderHandlers';
import { recorderInspect } from './recorderInspect';

export function registerRecorderTools() {
  toolRegistry.register({
    name: 'recorder_list',
    description: '分页列出录制记录；此工具不会返回录制事件',
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
    handler: recorder_list as ToolHandler,
  });

  toolRegistry.register({
    name: 'recorder_inspect',
    description: '检查一条录制的概况、控制台错误和失败网络请求。不会返回请求头、请求体或响应体。',
    parameters: createToolParameter(
      {
        id: { type: 'string', description: '录制 ID' },
        include: {
          type: 'string',
          enum: ['summary', 'errors', 'network', 'all'],
          description: '返回范围，默认 summary',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 50,
          description: '错误或失败请求最多返回多少条，默认 20',
        },
      },
      ['id']
    ),
    handler: recorderInspect as ToolHandler,
  });

  toolRegistry.register({
    name: 'recorder_start',
    description: '开始录制标签页（需要用户确认）',
    parameters: createToolParameter(
      {
        tabId: {
          type: 'integer',
          description: '要录制的标签页 ID，可选，默认使用当前标签页',
        },
      },
      []
    ),
    handler: recorder_start as ToolHandler,
    requiresConfirmation: true,
  });

  toolRegistry.register({
    name: 'recorder_stop',
    description: '停止录制',
    parameters: createToolParameter(
      {
        tabId: {
          type: 'number',
          description: '要停止录制的标签页 ID，可选，默认使用当前标签页',
        },
      },
      []
    ),
    handler: recorder_stop as ToolHandler,
  });

  toolRegistry.register({
    name: 'recorder_delete',
    description: '按 ID 删除录制记录',
    parameters: createToolParameter(
      {
        id: {
          type: 'string',
          description: '要删除的录制记录 ID',
        },
      },
      ['id']
    ),
    handler: recorder_delete as ToolHandler,
    requiresConfirmation: true,
  });

  toolRegistry.register({
    name: 'recorder_clear',
    description: '清空数据库中的所有录制记录',
    parameters: createToolParameter({}, []),
    handler: recorder_clear as ToolHandler,
    requiresConfirmation: true,
  });

  toolRegistry.register({
    name: 'recorder_updateTitle',
    description: '更新录制记录的标题',
    parameters: createToolParameter(
      {
        id: {
          type: 'string',
          description: '要更新的录制记录 ID',
        },
        title: {
          type: 'string',
          description: '录制记录的新标题',
        },
      },
      ['id', 'title']
    ),
    handler: recorder_updateTitle as ToolHandler,
    requiresConfirmation: true,
  });

  toolRegistry.register({
    name: 'recorder_import',
    description: '从 JSON 事件数组导入录制记录',
    parameters: createToolParameter(
      {
        events: {
          type: 'array',
          description: '要导入的 JSON 事件数组',
        },
        title: {
          type: 'string',
          description: '导入录制记录的标题，可选',
        },
      },
      ['events']
    ),
    handler: recorder_import as ToolHandler,
    requiresConfirmation: true,
  });

  toolRegistry.register({
    name: 'recorder_export',
    description: '将录制记录导出为 JSON',
    parameters: createToolParameter(
      {
        id: {
          type: 'string',
          description: '要导出的录制记录 ID',
        },
      },
      ['id']
    ),
    handler: recorder_export as ToolHandler,
    requiresConfirmation: true,
  });
}
