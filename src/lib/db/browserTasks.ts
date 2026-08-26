import { db } from '@/db';
import type { BrowserTaskRecord } from '@/db/typesDatabase';
import type { BrowserTaskSummary } from '@/lib/browserTask/types';

export async function getBrowserTaskRecord(taskId: string) {
  return db.browserTasks.get(taskId);
}

export async function listBrowserTaskRecords(sessionId?: string) {
  if (sessionId) return db.browserTasks.where('sessionId').equals(sessionId).toArray();
  return db.browserTasks.toArray();
}

export async function findBrowserTaskByIdempotencyKey(idempotencyKey: string) {
  return db.browserTasks.where('idempotencyKey').equals(idempotencyKey).first();
}

export async function reserveBrowserTask(input: {
  taskId: string;
  idempotencyKey: string;
  sessionId?: string;
  toolCallId?: string;
  task: string;
}): Promise<{ created: boolean; record: BrowserTaskRecord }> {
  return db.transaction('rw', db.browserTasks, async () => {
    const existing = await db.browserTasks
      .where('idempotencyKey')
      .equals(input.idempotencyKey)
      .first();
    if (existing) return { created: false, record: existing };

    const now = Date.now();
    const summary: BrowserTaskSummary = {
      taskId: input.taskId,
      sessionId: input.sessionId,
      toolCallId: input.toolCallId,
      task: input.task,
      initialTabId: -1,
      status: 'queued',
      history: [],
      createdAt: now,
      updatedAt: now,
    };
    const record: BrowserTaskRecord = {
      taskId: input.taskId,
      sessionId: input.sessionId,
      toolCallId: input.toolCallId,
      ownerKey: input.sessionId,
      status: 'queued',
      idempotencyKey: input.idempotencyKey,
      createdAt: now,
      summary,
      updatedAt: now,
    };
    await db.browserTasks.add(record);
    return { created: true, record };
  });
}

export async function deleteBrowserTaskRecord(taskId: string): Promise<void> {
  await db.browserTasks.delete(taskId);
}

export async function saveBrowserTaskSummary(summary: BrowserTaskSummary): Promise<void> {
  const createdAt = summary.createdAt ?? summary.updatedAt;
  const idempotencyKey =
    summary.sessionId && summary.toolCallId
      ? `${summary.sessionId}:${summary.toolCallId}`
      : undefined;
  const record: BrowserTaskRecord = {
    taskId: summary.taskId,
    sessionId: summary.sessionId,
    toolCallId: summary.toolCallId,
    ownerKey: summary.sessionId,
    status: summary.status,
    idempotencyKey,
    createdAt,
    summary: { ...summary, createdAt },
    updatedAt: summary.updatedAt,
  };
  await db.browserTasks.put({
    ...record,
  });
}
