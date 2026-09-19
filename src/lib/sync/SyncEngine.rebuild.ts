import type Dexie from 'dexie';
import { isSoftDeleted } from '@/lib/db/softDelete';
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

    const clientId = await ensureClientId();
    const operationsTable = db.table('operations');
    const entityTables = tables
      .filter((tableName) => db.tables.some((table) => table.name === tableName))
      .map((tableName) => db.table(tableName));

    // clear 与重建必须在同一事务内,避免中间崩溃丢失全部未同步 op
    await db.transaction('rw', [operationsTable, ...entityTables], async () => {
      await operationsTable.clear();

      for (const table of entityTables) {
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

          // 墓碑必须生成 delete op 并沿用实体原始时间戳,否则以 Date.now()
          // 重打时间戳的 create 会在 LWW 下覆盖其他设备上较晚重建的数据
          const record = item as { deletedAt?: number | null; updatedAt?: number };
          const deleted = isSoftDeleted(record);

          operations.push({
            id: generateUUID(),
            clientId,
            table: table.name,
            type: deleted ? 'delete' : 'create',
            key,
            payload: item,
            timestamp: record.deletedAt ?? record.updatedAt ?? Date.now(),
            synced: 0,
          });
        }

        if (operations.length > 0) {
          await operationsTable.bulkAdd(operations);
          logger.info(`[Sync] Regenerated ${operations.length} operations for table ${table.name}`);
        }
      }
    });

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
