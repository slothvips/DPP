import type Dexie from 'dexie';
import { addRemoteActivities } from '@/lib/db/remoteActivityLog';
import { logger } from '@/utils/logger';
import type { SyncTransaction } from './SyncEngine.shared';
import type { SyncOperation } from './types';

interface ProcessDeferredOperationsOptions {
  db: Dexie;
  tables: string[];
  applyOperation: (op: SyncOperation) => Promise<void>;
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
              } catch (error) {
                logger.error(
                  `[Sync] Failed to apply deferred op for ${tableName} (id: ${entry.op.id}), skipping:`,
                  error
                );
              }
            }

            await db.table('deferred_ops').where('table').equals(tableName).delete();
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

export async function archiveRemoteActivities(ops: SyncOperation[]) {
  if (ops.length > 0) {
    await addRemoteActivities(ops);
  }
}
