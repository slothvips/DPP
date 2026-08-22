import type Dexie from 'dexie';
import { logger } from '@/utils/logger';
import type { SyncOperation } from './types';

interface SyncRecoveryOp {
  id: string;
  operation: SyncOperation;
  timestamp: number;
}

export async function saveSyncOperationForRecovery(
  db: Dexie,
  operation: SyncOperation
): Promise<void> {
  try {
    await db.table('syncRecoveryOps').put({
      id: operation.id,
      operation,
      timestamp: Date.now(),
    });
    logger.warn(`[Sync] Queued operation ${operation.id} for recovery`);
  } catch (recoveryError) {
    logger.error(`[Sync] Failed to persist operation ${operation.id} for recovery:`, recoveryError);
  }
}

export async function processSyncOperationRecovery(
  db: Dexie,
  ensureClientId?: () => Promise<string>
): Promise<void> {
  let entries: SyncRecoveryOp[];
  try {
    entries = (await db
      .table('syncRecoveryOps')
      .orderBy('timestamp')
      .toArray()) as SyncRecoveryOp[];
  } catch (error) {
    logger.error('[Sync] Failed to load operation recovery queue:', error);
    return;
  }

  for (const entry of entries) {
    try {
      const operation = entry.operation.clientId
        ? entry.operation
        : ensureClientId
          ? { ...entry.operation, clientId: await ensureClientId() }
          : entry.operation;
      if (!operation.clientId) {
        throw new Error(`Recovery operation ${entry.id} is missing clientId`);
      }
      await db.transaction(
        'rw',
        [db.table('operations'), db.table('syncRecoveryOps')],
        async () => {
          await db.table('operations').put(operation);
          await db.table('syncRecoveryOps').delete(entry.id);
        }
      );
      logger.info(`[Sync] Recovered operation ${entry.id}`);
    } catch (error) {
      logger.error(`[Sync] Failed to recover operation ${entry.id}:`, error);
    }
  }
}
