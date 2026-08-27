import type Dexie from 'dexie';
import type { DeferredOp, SyncChunkRecord } from '@/db/typesSync';
import { addRemoteActivities } from '@/lib/db/remoteActivityLog';
import { logger } from '@/utils/logger';
import type { SyncTransaction } from './SyncEngine.shared';
import { isSyncChunkOperation, mergeChunkRecords, toSyncChunkRecord } from './chunks';
import type { SyncOperation } from './types';

interface ProcessDeferredOperationsOptions {
  db: Dexie;
  tables: string[];
  applyOperation: (op: SyncOperation) => Promise<void>;
}

export const PENDING_DECRYPT_TABLE = '__sync_pending_decrypt__';

export async function migrateDeferredChunks(db: Dexie): Promise<void> {
  try {
    const entries = (await db.table('deferred_ops').toArray()) as DeferredOp[];
    const chunkEntries = entries.filter((entry) => isSyncChunkOperation(entry.op));
    if (chunkEntries.length === 0) return;

    const incoming = chunkEntries
      .map((entry) => toSyncChunkRecord(entry.op, entry.receivedAt))
      .filter((record): record is NonNullable<typeof record> => record !== null);
    const existing = (await db.table('syncChunks').toArray()) as SyncChunkRecord[];
    const merged = mergeChunkRecords(existing, incoming);
    for (const conflict of merged.conflicts) {
      logger.error(`[Sync] Conflicting deferred chunk ignored: ${conflict.id}`);
    }

    await db.transaction('rw', [db.table('deferred_ops'), db.table('syncChunks')], async () => {
      const existingIds = new Set(existing.map((record) => record.id));
      for (const entry of chunkEntries) {
        const record = toSyncChunkRecord(entry.op, entry.receivedAt);
        if (!record || entry.id === undefined) continue;

        if (!existingIds.has(record.id)) {
          await db.table('syncChunks').put(record);
          existingIds.add(record.id);
        }
        await db.table('deferred_ops').delete(entry.id);
      }
    });
  } catch (error) {
    logger.error('[Sync] Failed to migrate deferred sync chunks; keeping them for retry:', error);
  }
}

export async function processDeferredOperationsForKnownTables({
  db,
  tables,
  applyOperation,
}: ProcessDeferredOperationsOptions) {
  try {
    const deferredTables = await db.table('deferred_ops').orderBy('table').uniqueKeys();
    const tablesToProcess = deferredTables.filter((tableName) =>
      tables.includes(tableName as string)
    );

    if (tablesToProcess.length === 0) {
      return;
    }

    logger.info(
      `[Sync] Processing deferred operations for new tables: ${tablesToProcess.join(', ')}`
    );

    for (const tableName of tablesToProcess) {
      try {
        await db.transaction(
          'rw',
          [db.table('deferred_ops'), db.table(tableName as string)],
          async (transaction) => {
            (transaction as SyncTransaction).source = 'sync';

            const entries = await db
              .table('deferred_ops')
              .where('table')
              .equals(tableName)
              .sortBy('timestamp');

            for (const entry of entries) {
              try {
                await applyOperation(entry.op);
                if (entry.id === undefined) {
                  logger.error(
                    `[Sync] Deferred op for ${tableName} has no id (operation: ${entry.op.id}), keeping it`
                  );
                  continue;
                }

                await db.table('deferred_ops').delete(entry.id);
              } catch (error) {
                logger.error(
                  `[Sync] Failed to apply deferred op for ${tableName} (id: ${entry.op.id}), keeping it:`,
                  error
                );
              }
            }
          }
        );
        logger.info(`[Sync] Successfully processed deferred operations for ${tableName}`);
      } catch (error) {
        logger.error(`[Sync] Failed to process deferred table ${tableName}:`, error);
      }
    }
  } catch (error) {
    logger.error('[Sync] Failed to process deferred operations:', error);
  }
}

export async function archiveRemoteActivities(db: Dexie, ops: SyncOperation[]) {
  if (ops.length > 0) {
    await addRemoteActivities(ops, db);
  }
}
