import { db } from '@/db';
import type { Recording } from '@/features/recorder/types';

export async function getAllRecordings(): Promise<Recording[]> {
  return db.recordings.orderBy('createdAt').reverse().toArray();
}

export async function getRecordingById(id: string): Promise<Recording | undefined> {
  return db.recordings.get(id);
}
