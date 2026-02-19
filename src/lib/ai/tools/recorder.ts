// Recorder management AI tools
import {
  clearRecordings,
  deleteRecording,
  exportRecordingAsJson,
  importRecordingFromJson,
  updateRecordingTitle,
} from '@/lib/db';
import { createToolParameter, toolRegistry } from '../tools';
import type { ToolHandler } from '../tools';

/**
 * Send message to background script and get response
 */
async function sendRecorderMessage<T>(message: {
  type: string;
  [key: string]: unknown;
}): Promise<T> {
  const response = (await browser.runtime.sendMessage(message)) as {
    success: boolean;
    data?: T;
    error?: string;
  };
  if (!response || !response.success) {
    throw new Error(response?.error || 'Failed to communicate with recorder service');
  }
  return response.data as T;
}

/**
 * List all recordings
 */
async function recorder_list() {
  const response = await sendRecorderMessage<{
    recordings: Array<{
      id: string;
      title: string;
      url: string;
      favicon?: string;
      createdAt: number;
      duration: number;
      eventsCount: number;
      fileSize: number;
    }>;
  }>({ type: 'RECORDER_GET_ALL_RECORDINGS' });

  return {
    total: response.recordings.length,
    recordings: response.recordings.map((r) => ({
      id: r.id,
      title: r.title,
      url: r.url,
      favicon: r.favicon,
      createdAt: r.createdAt,
      duration: r.duration,
      eventsCount: r.eventsCount,
      fileSize: r.fileSize,
    })),
  };
}

/**
 * Start recording
 */
async function recorder_start(args: { tabId?: number }) {
  // Get current tab if not specified
  let targetTabId = args.tabId;
  if (!targetTabId) {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs.length === 0 || !tabs[0].id) {
      throw new Error('No active tab found. Please specify tabId or open a tab.');
    }
    targetTabId = tabs[0].id;
  }

  await sendRecorderMessage({ type: 'RECORDER_START', tabId: targetTabId });

  return {
    success: true,
    message: `Recording started on tab ${targetTabId}`,
    tabId: targetTabId,
  };
}

/**
 * Stop recording
 */
async function recorder_stop(args: { tabId?: number }) {
  // Get current tab if not specified
  let targetTabId = args.tabId;
  if (!targetTabId) {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs.length === 0 || !tabs[0].id) {
      throw new Error('No active tab found. Please specify tabId or open a tab.');
    }
    targetTabId = tabs[0].id;
  }

  await sendRecorderMessage({ type: 'RECORDER_STOP', tabId: targetTabId });

  return {
    success: true,
    message: `Recording stopped on tab ${targetTabId}`,
    tabId: targetTabId,
  };
}

/**
 * Delete a recording by ID
 */
async function recorder_delete(args: { id: string }) {
  return deleteRecording({ id: args.id });
}

/**
 * Clear all recordings
 */
async function recorder_clear() {
  return clearRecordings();
}

/**
 * Update recording title
 */
async function recorder_updateTitle(args: { id: string; title: string }) {
  return updateRecordingTitle({ id: args.id, title: args.title });
}

/**
 * Import recording from JSON
 */
async function recorder_import(args: { events: unknown[]; title?: string }) {
  return importRecordingFromJson({ events: args.events, title: args.title });
}

/**
 * Export recording as JSON
 */
async function recorder_export(args: { id: string }) {
  return exportRecordingAsJson({ id: args.id });
}

/**
 * Register all recorder tools
 */
export function registerRecorderTools() {
  // recorder_list
  toolRegistry.register({
    name: 'recorder_list',
    description: 'List all recordings',
    parameters: createToolParameter({}, []),
    handler: recorder_list as ToolHandler,
  });

  // recorder_start (requires confirmation)
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

  // recorder_stop
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

  // recorder_delete
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
  });

  // recorder_clear
  toolRegistry.register({
    name: 'recorder_clear',
    description: 'Clear all recordings from the database',
    parameters: createToolParameter({}, []),
    handler: recorder_clear as ToolHandler,
  });

  // recorder_updateTitle
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

  // recorder_import
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
  });

  // recorder_export
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
