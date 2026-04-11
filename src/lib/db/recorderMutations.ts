import { db } from '@/db';
import type { Recording } from '@/features/recorder/types';
import type {
  ClearRecordingsResult,
  DeleteRecordingResult,
  UpdateRecordingTitleResult,
} from './recorderShared';

export async function addRecording(recording: Recording): Promise<string> {
  await db.recordings.add(recording);
  return recording.id;
}

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
