import { db } from '@/db';
import type { Recording } from '@/features/recorder/types';
import type { ExportRecordingResult, ImportRecordingResult } from './recorderShared';

function buildRecordingExportFilename(title: string, createdAt: number): string {
  const safeTitle = title.replace(/[^a-z0-9\u4e00-\u9fa5]/gi, '_');
  const dateStr = new Date(createdAt).toISOString().replace(/[:.]/g, '-');
  return `${safeTitle}-${dateStr}.rrweb.json`;
}

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

    const firstEvent = events[0] as { timestamp?: unknown };
    const lastEvent = events[events.length - 1] as { timestamp?: unknown };

    if (typeof firstEvent?.timestamp !== 'number') {
      return { success: false, id: '', message: 'Invalid recording format: missing timestamps' };
    }

    const startTime = firstEvent.timestamp;
    const endTime = lastEvent?.timestamp as number;
    const duration = endTime - startTime;
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

export async function exportRecordingAsJson(args: { id: string }): Promise<ExportRecordingResult> {
  try {
    const { id } = args;
    const recording = await db.recordings.get(id);

    if (!recording) {
      return { success: false, data: null, filename: '', message: 'Recording not found' };
    }

    return {
      success: true,
      data: recording.events,
      filename: buildRecordingExportFilename(recording.title, recording.createdAt),
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
