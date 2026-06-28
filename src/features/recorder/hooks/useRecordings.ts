import { useLiveQuery } from 'dexie-react-hooks';
import {
  clearRecordings as dbClearRecordings,
  deleteRecording as dbDeleteRecording,
  updateRecordingTitle as dbUpdateRecordingTitle,
  exportRecordingAsJson,
  getAllRecordingMetas,
  importRecordingFromJson,
} from '@/lib/db/recorder';
import { logger } from '@/utils/logger';
import type { RecordingMeta } from '../types';

export function useRecordings() {
  // 仅查询元数据(不含 events 数组),避免 UI 长期持有大量事件数据
  const recordings = useLiveQuery(() => getAllRecordingMetas(), []);

  const deleteRecording = async (id: string) => {
    const result = await dbDeleteRecording({ id });
    if (!result.success) {
      logger.error(result.message);
    }
    return result;
  };

  const clearRecordings = async () => {
    const result = await dbClearRecordings();
    if (!result.success) {
      logger.error(result.message);
    }
    return result;
  };

  const updateTitle = async (id: string, title: string) => {
    const result = await dbUpdateRecordingTitle({ id, title });
    if (!result.success) {
      logger.error(result.message);
    }
    return result;
  };

  const importRecording = async (file: File) => {
    const text = await file.text();
    const events = JSON.parse(text) as unknown[];
    const title = file.name.replace(/\.rrweb\.json$/i, '').replace(/\.json$/i, '');

    const result = await importRecordingFromJson({ events, title });
    if (!result.success) {
      throw new Error(result.message);
    }

    return result.id;
  };

  const exportRecording = async (recording: RecordingMeta) => {
    const result = await exportRecordingAsJson({ id: recording.id });
    if (!result.success || !result.data) {
      throw new Error(result.message);
    }

    const blob = new Blob([JSON.stringify(result.data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = result.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return {
    recordings,
    deleteRecording,
    clearRecordings,
    updateTitle,
    exportRecording,
    importRecording,
  };
}
