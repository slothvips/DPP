import type Dexie from 'dexie';
import { logger } from '@/utils/logger';
import type { SyncTransaction } from './SyncEngine.shared';
import { getTableDataScope } from './dataScope';

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
      [
        db.table('syncMetadata'),
        db.table('operations'),
        db.table('deferred_ops'),
        db.table('syncRecoveryOps'),
        db.table('syncChunks'),
        db.table('syncApplyQueue'),
        db.table('remoteActivityLog'),
      ],
      async () => {
        await db.table('syncMetadata').clear();
        await db.table('operations').clear();
        await db.table('deferred_ops').clear();
        await db.table('syncRecoveryOps').clear();
        await db.table('syncChunks').clear();
        await db.table('syncApplyQueue').clear();
        await db.table('remoteActivityLog').clear();
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
  /**
   * 为 true 时跳过 personal 表（如 totpAccounts）。
   * 重建本地数据应传 false；普通清空/换团队钥 member 模式默认 true。
   */
  preservePersonal?: boolean;
}

/**
 * 清空同步元数据、operations 与同步业务表。
 * `preservePersonal: true`（默认）时保留个人域表。
 */
export async function clearAllSyncData({
  db,
  tables,
  syncLock,
  setSyncLock,
  setStatus,
  resetRuntimeState,
  preservePersonal = true,
}: ClearAllDataOptions) {
  if (syncLock) {
    throw new Error('Cannot clear data while sync is in progress');
  }

  try {
    setSyncLock(true);
    setStatus('idle');

    const entityTables = preservePersonal
      ? tables.filter((tableName) => getTableDataScope(tableName) !== 'personal')
      : tables;
    const tablesToClear = [
      'syncMetadata',
      'operations',
      'deferred_ops',
      'syncRecoveryOps',
      'syncChunks',
      'syncApplyQueue',
      'remoteActivityLog',
      ...entityTables,
    ];
    const skippedPersonal = preservePersonal
      ? tables.filter((tableName) => getTableDataScope(tableName) === 'personal')
      : [];

    await db.transaction(
      'rw',
      [...tablesToClear.map((tableName) => db.table(tableName)), db.table('settings')],
      async (transaction) => {
        (transaction as SyncTransaction).source = 'sync';
        for (const tableName of tablesToClear) {
          await db.table(tableName).clear();
        }
        await db.table('settings').delete('sync_client_id');
        resetRuntimeState();
      }
    );

    if (skippedPersonal.length > 0) {
      logger.info(
        `[Sync] Cleared sync data; preserved personal tables: ${skippedPersonal.join(', ')}`
      );
    } else {
      logger.info('[Sync] All local sync data and sync state cleared.');
    }
  } catch (error) {
    logger.error('[Sync] Failed to clear all data:', error);
    throw error;
  } finally {
    setSyncLock(false);
  }
}
