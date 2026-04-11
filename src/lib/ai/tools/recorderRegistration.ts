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

export function registerRecorderTools() {
  toolRegistry.register({
    name: 'recorder_list',
    description: 'List all recordings',
    parameters: createToolParameter({}, []),
    handler: recorder_list as ToolHandler,
  });

  toolRegistry.register({
    name: 'recorder_start',
    description: 'Start recording a tab (requires user confirmation)',
    parameters: createToolParameter(
      {
        tabId: {
          type: 'number',
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
      []
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
      []
    ),
    handler: recorder_updateTitle as ToolHandler,
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
      []
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
      []
    ),
    handler: recorder_export as ToolHandler,
  });
}
