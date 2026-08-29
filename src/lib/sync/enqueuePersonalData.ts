import type Dexie from 'dexie';
import { isSoftDeleted } from '@/lib/db/softDelete';
import { logger } from '@/utils/logger';
import { generateUUID } from './SyncEngine.shared';
import { PERSONAL_SYNC_TABLES } from './dataScope';
import type { SyncOperation } from './types';

interface EnqueuePersonalSyncDataOptions {
  db: Dexie;
  ensureClientId: () => Promise<string>;
  /** 默认 PERSONAL_SYNC_TABLES */
  tables?: string[];
}

/**
 * 将本地个人同步表中的记录与删除墓碑补入 operations（synced=0），供后续用个人私钥上传。
 * 不会清空团队 ops；会去掉同表同 key 的未同步旧 op 以免重复。
 */
export async function enqueuePersonalSyncData({
  db,
  ensureClientId,
  tables = PERSONAL_SYNC_TABLES,
}: EnqueuePersonalSyncDataOptions): Promise<number> {
  if (tables.length === 0) {
    return 0;
  }

  const clientId = await ensureClientId();
  const operationsTable = db.table('operations');
  let enqueued = 0;

  await db.transaction(
    'rw',
    [operationsTable, ...tables.map((name) => db.table(name))],
    async () => {
      for (const tableName of tables) {
        if (!db.tables.some((table) => table.name === tableName)) {
          logger.warn(`[Sync] Skip enqueue: table not found: ${tableName}`);
          continue;
        }

        const table = db.table(tableName);
        const items = await table.toArray();

        const primKeyPath = table.schema.primKey.keyPath;
        const pendingOps = (await operationsTable
          .where('synced')
          .equals(0)
          .filter((op) => (op as SyncOperation).table === tableName)
          .toArray()) as SyncOperation[];

        const keysToReplace = new Set(
          items.map((item) => JSON.stringify(readPrimaryKey(item, primKeyPath)))
        );

        const staleIds = pendingOps
          .filter((op) => keysToReplace.has(JSON.stringify(op.key)))
          .map((op) => op.id);

        if (staleIds.length > 0) {
          await operationsTable.bulkDelete(staleIds);
        }

        const operations: SyncOperation[] = [];
        for (const item of items) {
          const key = readPrimaryKey(item, primKeyPath);
          const record = item as { deletedAt?: number | null; updatedAt?: number };
          const deleted = isSoftDeleted(record);
          operations.push({
            id: generateUUID(),
            clientId,
            table: tableName,
            type: deleted ? 'delete' : 'create',
            key,
            payload: item,
            timestamp: record.deletedAt ?? record.updatedAt ?? Date.now(),
            synced: 0,
          });
        }

        if (operations.length > 0) {
          await operationsTable.bulkAdd(operations);
          enqueued += operations.length;
          logger.info(`[Sync] Enqueued ${operations.length} personal ops for ${tableName}`);
        }
      }
    }
  );

  return enqueued;
}

function readPrimaryKey(item: unknown, primKeyPath: string | string[] | undefined): unknown {
  const record = item as Record<string, unknown>;
  if (typeof primKeyPath === 'string') {
    return record[primKeyPath];
  }
  if (Array.isArray(primKeyPath)) {
    return primKeyPath.map((path) => record[path]);
  }
  return undefined;
}
