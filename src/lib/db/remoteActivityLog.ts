// Unified remote activity log database operations
import { db } from '@/db';
import type { RemoteActivityLog } from '@/db/types';
import type { SyncOperation } from '@/lib/sync/types';

/**
 * Add multiple remote operations to the activity log
 */
export async function addRemoteActivities(operations: SyncOperation[]): Promise<void> {
  if (operations.length === 0) return;

  const receivedAt = Date.now();
  const logs: RemoteActivityLog[] = operations.map((op) => ({
    id: op.id,
    clientId: op.clientId || 'unknown',
    table: op.table,
    type: op.type,
    timestamp: op.timestamp,
    payload: op.payload,
    receivedAt,
  }));

  await db.remoteActivityLog.bulkAdd(logs);
}

/**
 * Get remote activities within a time range
 */
export async function getRemoteActivities(
  startTime: number,
  endTime: number
): Promise<RemoteActivityLog[]> {
  return db.remoteActivityLog.where('timestamp').between(startTime, endTime).toArray();
}

/**
 * Get local sync operations within a time range
 */
export async function getLocalOperations(
  startTime: number,
  endTime: number
): Promise<SyncOperation[]> {
  return db.operations.where('timestamp').between(startTime, endTime).toArray();
}
