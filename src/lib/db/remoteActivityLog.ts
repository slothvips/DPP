// Unified remote activity log database operations
import type Dexie from 'dexie';
import { db } from '@/db';
import type { RemoteActivityLog } from '@/db/types';
import type { SyncOperation } from '@/lib/sync/types';

const MAX_REMOTE_ACTIVITY_LOGS = 10_000;

/**
 * Add multiple remote operations to the activity log
 */
export async function addRemoteActivities(
  operations: SyncOperation[],
  database: Dexie = db
): Promise<void> {
  if (operations.length === 0) return;

  const receivedAt = Date.now();
  const logs: RemoteActivityLog[] = operations.map((op) => ({
    id: op.id,
    clientId: op.clientId || 'unknown',
    table: op.table,
    type: op.type,
    timestamp: op.timestamp,
    receivedAt,
  }));

  // Activity archiving must be idempotent so repeated pulls do not wedge sync on duplicate IDs.
  const table = database.table('remoteActivityLog');
  await table.bulkPut(logs);
  const count = await table.count();
  if (count > MAX_REMOTE_ACTIVITY_LOGS) {
    const staleIds = await table
      .orderBy('receivedAt')
      .limit(count - MAX_REMOTE_ACTIVITY_LOGS)
      .primaryKeys();
    await table.bulkDelete(staleIds);
  }
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
