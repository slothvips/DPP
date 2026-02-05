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

  const importRecording = async (file: File) => {
    const text = await file.text();
    const events = JSON.parse(text);

    if (!Array.isArray(events) || events.length === 0) {
      throw new Error('Invalid recording file: content must be a non-empty array of events');
    }

    if (typeof events[0].timestamp !== 'number') {
      throw new Error('Invalid recording format: missing timestamps');
    }

    const startTime = events[0].timestamp;
    const endTime = events[events.length - 1].timestamp;
    const duration = endTime - startTime;

    const recording: Recording = {
      id: crypto.randomUUID(),
      title: file.name.replace(/\.rrweb\.json$/i, '').replace(/\.json$/i, ''),
      url: '',
      createdAt: Date.now(),
      duration: duration > 0 ? duration : 0,
      eventsCount: events.length,
      fileSize: file.size,
      events,
    };

    await db.recordings.add(recording);
    return recording.id;
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
    importRecording,
  };
}
