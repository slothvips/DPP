import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import type { Recording } from '../types';

export function useRecordings() {
  const recordings = useLiveQuery(() => db.recordings.orderBy('createdAt').reverse().toArray(), []);

  const deleteRecording = async (id: string) => {
    await db.recordings.delete(id);
  };

  const clearRecordings = async () => {
    await db.recordings.clear();
  };

  const updateTitle = async (id: string, title: string) => {
    await db.recordings.update(id, { title });
  };

  const exportRecording = (recording: Recording) => {
    const safeTitle = recording.title.replace(/[^a-z0-9\u4e00-\u9fa5]/gi, '_'); // Allow Chinese characters
    const dateStr = new Date(recording.createdAt).toISOString().replace(/[:.]/g, '-');
    const filename = `${safeTitle}-${dateStr}.rrweb.json`;

    const blob = new Blob([JSON.stringify(recording.events)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
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
  };
}
