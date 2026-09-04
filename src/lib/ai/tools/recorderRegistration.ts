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
    description:
      'List recordings with pagination; recording events are never returned by this tool',
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
    description: 'Start recording a tab (requires user confirmation)',
    parameters: createToolParameter(
      {
        tabId: {
          type: 'integer',
          description: 'Tab ID to record (optional, defaults to current tab)',
        },
      },
      []
    ),
    handler: recorder_start as ToolHandler,
    requiresConfirmation: true,
  });

  toolRegistry.register({
    name: 'recorder_stop',
    description: 'Stop recording',
    parameters: createToolParameter(
      {
        tabId: {
          type: 'number',
          description: 'Tab ID to stop recording (optional, defaults to current tab)',
        },
      },
      []
    ),
    handler: recorder_stop as ToolHandler,
  });

  toolRegistry.register({
    name: 'recorder_delete',
    description: 'Delete a recording by ID',
    parameters: createToolParameter(
      {
        id: {
          type: 'string',
          description: 'The ID of the recording to delete',
        },
      },
      ['id']
    ),
    handler: recorder_delete as ToolHandler,
    requiresConfirmation: true,
  });

  toolRegistry.register({
    name: 'recorder_clear',
    description: 'Clear all recordings from the database',
    parameters: createToolParameter({}, []),
    handler: recorder_clear as ToolHandler,
    requiresConfirmation: true,
  });

  toolRegistry.register({
    name: 'recorder_updateTitle',
    description: 'Update the title of a recording',
    parameters: createToolParameter(
      {
        id: {
          type: 'string',
          description: 'The ID of the recording to update',
        },
        title: {
          type: 'string',
          description: 'The new title for the recording',
        },
      },
      ['id', 'title']
    ),
    handler: recorder_updateTitle as ToolHandler,
    requiresConfirmation: true,
  });

  toolRegistry.register({
    name: 'recorder_import',
    description: 'Import a recording from JSON events array',
    parameters: createToolParameter(
      {
        events: {
          type: 'array',
          description: 'The JSON events array to import',
        },
        title: {
          type: 'string',
          description: 'Optional title for the imported recording',
        },
      },
      ['events']
    ),
    handler: recorder_import as ToolHandler,
    requiresConfirmation: true,
  });

  toolRegistry.register({
    name: 'recorder_export',
    description: 'Export a recording as JSON',
    parameters: createToolParameter(
      {
        id: {
          type: 'string',
          description: 'The ID of the recording to export',
        },
      },
      ['id']
    ),
    handler: recorder_export as ToolHandler,
    requiresConfirmation: true,
  });
}
