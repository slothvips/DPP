import { db } from '@/db';
import type { Recording } from '@/features/recorder/types';

export interface DeleteRecordingResult {
  success: boolean;
  message: string;
}

export interface ClearRecordingsResult {
  success: boolean;
  message: string;
}

export interface UpdateRecordingTitleResult {
  success: boolean;
  message: string;
}

export interface ImportRecordingResult {
  success: boolean;
  id: string;
  message: string;
}

export interface ExportRecordingResult {
  success: boolean;
  data: unknown;
  filename: string;
  message: string;
}

/**
 * Delete a single recording by ID
 */
export async function deleteRecording(args: { id: string }): Promise<DeleteRecordingResult> {
  try {
    const { id } = args;
    const existing = await db.recordings.get(id);
    if (!existing) {
      return { success: false, message: 'Recording not found' };
    }
    await db.recordings.delete(id);
    return { success: true, message: 'Recording deleted successfully' };
  } catch (error) {
    return {
      success: false,
      message: `Failed to delete recording: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Clear all recordings from the database
 */
export async function clearRecordings(): Promise<ClearRecordingsResult> {
  try {
    await db.recordings.clear();
    return { success: true, message: 'All recordings cleared successfully' };
  } catch (error) {
    return {
      success: false,
      message: `Failed to clear recordings: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Update recording title by ID
 */
export async function updateRecordingTitle(args: {
  id: string;
  title: string;
}): Promise<UpdateRecordingTitleResult> {
  try {
    const { id, title } = args;
    const existing = await db.recordings.get(id);
    if (!existing) {
      return { success: false, message: 'Recording not found' };
    }
    await db.recordings.update(id, { title });
    return { success: true, message: 'Recording title updated successfully' };
  } catch (error) {
    return {
      success: false,
      message: `Failed to update recording title: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Import recording from JSON events array
 */
export async function importRecordingFromJson(args: {
  events: unknown[];
  title?: string;
}): Promise<ImportRecordingResult> {
  try {
    const { events, title } = args;

    if (!Array.isArray(events) || events.length === 0) {
      return {
        success: false,
        id: '',
        message: 'Invalid recording data: events must be a non-empty array',
      };
    }

    // Validate timestamp format
    const firstEvent = events[0] as { timestamp?: unknown };
    const lastEvent = events[events.length - 1] as { timestamp?: unknown };

    if (typeof firstEvent?.timestamp !== 'number') {
      return { success: false, id: '', message: 'Invalid recording format: missing timestamps' };
    }

    const startTime = firstEvent.timestamp;
    const endTime = lastEvent?.timestamp as number;
    const duration = endTime - startTime;

    // Calculate approximate file size from JSON string
    const eventsJson = JSON.stringify(events);
    const fileSize = new Blob([eventsJson]).size;

    const recording: Recording = {
      id: crypto.randomUUID(),
      title: title || 'Imported Recording',
      url: '',
      createdAt: Date.now(),
      duration: duration > 0 ? duration : 0,
      eventsCount: events.length,
      fileSize,
      events,
    };

    await db.recordings.add(recording);
    return { success: true, id: recording.id, message: 'Recording imported successfully' };
  } catch (error) {
    return {
      success: false,
      id: '',
      message: `Failed to import recording: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Export recording as JSON
 */
export async function exportRecordingAsJson(args: { id: string }): Promise<ExportRecordingResult> {
  try {
    const { id } = args;
    const recording = await db.recordings.get(id);

    if (!recording) {
      return { success: false, data: null, filename: '', message: 'Recording not found' };
    }

    const safeTitle = recording.title.replace(/[^a-z0-9\u4e00-\u9fa5]/gi, '_');
    const dateStr = new Date(recording.createdAt).toISOString().replace(/[:.]/g, '-');
    const filename = `${safeTitle}-${dateStr}.rrweb.json`;

    return {
      success: true,
      data: recording.events,
      filename,
      message: 'Recording exported successfully',
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      filename: '',
      message: `Failed to export recording: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
