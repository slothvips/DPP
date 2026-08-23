import { db } from '@/db';
import type { BrowserTaskSummary } from '@/lib/browserTask/types';

export async function getBrowserTaskRecord(taskId: string) {
  return db.browserTasks.get(taskId);
}

export async function listBrowserTaskRecords(sessionId?: string) {
  if (sessionId) return db.browserTasks.where('sessionId').equals(sessionId).toArray();
  return db.browserTasks.toArray();
}

export async function saveBrowserTaskSummary(summary: BrowserTaskSummary): Promise<void> {
  await db.browserTasks.put({
    taskId: summary.taskId,
    sessionId: summary.sessionId,
    summary,
    updatedAt: summary.updatedAt,
  });
}
