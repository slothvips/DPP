import type Dexie from 'dexie';
import { logger } from '@/utils/logger';
import { processDeferredOperationsForKnownTables } from './SyncEngine.deferred';
import { generateUUID } from './SyncEngine.shared';
import type { SyncOperation } from './types';

interface RegenerateOperationsOptions {
  db: Dexie;
  tables: string[];
  syncLock: boolean;
  setSyncLock: (value: boolean) => void;
  ensureClientId: () => Promise<string>;
}

export async function regenerateSyncOperations({
  db,
  tables,
  syncLock,
  setSyncLock,
  ensureClientId,
}: RegenerateOperationsOptions) {
  if (syncLock) {
    throw new Error('Cannot regenerate operations while sync is in progress');
  }

  try {
    setSyncLock(true);

    await db.table('operations').clear();

    for (const tableName of tables) {
      const table = db.table(tableName);
      const items = await table.toArray();
      const primKeyPath = table.schema.primKey.keyPath;

      const operations: SyncOperation[] = [];

      for (const item of items) {
        let key: unknown;
        if (typeof primKeyPath === 'string') {
          key = item[primKeyPath as keyof typeof item];
        } else if (Array.isArray(primKeyPath)) {
          key = primKeyPath.map((path) => item[path as keyof typeof item]);
        }

        operations.push({
          id: generateUUID(),
          clientId: await ensureClientId(),
          table: tableName,
          type: 'create',
          key,
          payload: item,
          timestamp: Date.now(),
          synced: 0,
        });
      }

      if (operations.length > 0) {
        await db.table('operations').bulkAdd(operations);
        logger.info(`[Sync] Regenerated ${operations.length} operations for table ${tableName}`);
      }
    }

    logger.info('[Sync] Operations regeneration complete.');
  } catch (error) {
    logger.error('[Sync] Failed to regenerate operations:', error);
    throw error;
  } finally {
    setSyncLock(false);
  }
}

interface ProcessDeferredOperationsOptions {
  db: Dexie;
  tables: string[];
  applyOperation: (op: SyncOperation) => Promise<void>;
}

export async function processDeferredOperations({
  db,
  tables,
  applyOperation,
}: ProcessDeferredOperationsOptions) {
  await processDeferredOperationsForKnownTables({
    db,
    tables,
    applyOperation,
  });
}
