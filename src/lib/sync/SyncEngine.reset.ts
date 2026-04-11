import type Dexie from 'dexie';
import { logger } from '@/utils/logger';
import type { SyncTransaction } from './SyncEngine.shared';

interface ResetSyncStateOptions {
  db: Dexie;
  syncLock: boolean;
  setSyncLock: (value: boolean) => void;
  setStatus: (status: 'idle') => void;
  resetRuntimeState: () => void;
}

export async function resetSyncState({
  db,
  syncLock,
  setSyncLock,
  setStatus,
  resetRuntimeState,
}: ResetSyncStateOptions) {
  if (syncLock) {
    throw new Error('Cannot reset sync while sync is in progress');
  }

  try {
    setSyncLock(true);
    setStatus('idle');

    await db.transaction(
      'rw',
      db.table('syncMetadata'),
      db.table('operations'),
      db.table('deferred_ops'),
      async () => {
        await db.table('syncMetadata').clear();
        await db.table('operations').clear();
        await db.table('deferred_ops').clear();
        resetRuntimeState();
      }
    );

    logger.info('[Sync] Sync state reset.');
  } catch (error) {
    logger.error('[Sync] Failed to reset sync state:', error);
    throw error;
  } finally {
    setSyncLock(false);
  }
}

interface ClearAllDataOptions {
  db: Dexie;
  tables: string[];
  syncLock: boolean;
  setSyncLock: (value: boolean) => void;
  setStatus: (status: 'idle') => void;
  resetRuntimeState: () => void;
}

export async function clearAllSyncData({
  db,
  tables,
  syncLock,
  setSyncLock,
  setStatus,
  resetRuntimeState,
}: ClearAllDataOptions) {
  if (syncLock) {
    throw new Error('Cannot clear data while sync is in progress');
  }

  try {
    setSyncLock(true);
    setStatus('idle');

    const tablesToClear = ['syncMetadata', 'operations', 'deferred_ops', ...tables];

    await db.transaction(
      'rw',
      tablesToClear.map((tableName) => db.table(tableName)),
      async (transaction) => {
        (transaction as SyncTransaction).source = 'sync';
        for (const tableName of tablesToClear) {
          await db.table(tableName).clear();
        }
        resetRuntimeState();
      }
    );

    logger.info('[Sync] All local data and sync state cleared.');
  } catch (error) {
    logger.error('[Sync] Failed to clear all data:', error);
    throw error;
  } finally {
    setSyncLock(false);
  }
}
