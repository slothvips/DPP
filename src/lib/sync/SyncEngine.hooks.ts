import type Dexie from 'dexie';
import { logger } from '@/utils/logger';
import type { SyncTransaction } from './SyncEngine.shared';
import type { OperationType } from './types';

interface RegisterSyncHooksOptions {
  db: Dexie;
  tables: string[];
  isRegistered: () => boolean;
  recordOperation: (
    table: string,
    type: OperationType,
    key: unknown,
    payload: unknown
  ) => Promise<void>;
}

export function registerSyncHooks({
  db,
  tables,
  isRegistered,
  recordOperation,
}: RegisterSyncHooksOptions) {
  for (const tableName of tables) {
    const table = db.table(tableName);

    table.hook('creating', function (_primKey, object, transaction) {
      if (!isRegistered()) {
        return;
      }

      const syncTransaction = transaction as SyncTransaction | undefined;
      if (syncTransaction?.source === 'sync') {
        return;
      }

      const now = Date.now();
      const objectWithTimestamp = { ...object, updatedAt: now };

      this.onsuccess = function (resultKey: unknown) {
        queueMicrotask(() => {
          if (!isRegistered()) {
            return;
          }

          let payload = objectWithTimestamp;
          if (_primKey === undefined && resultKey !== undefined) {
            payload = { ...objectWithTimestamp, id: resultKey };
          }

          void recordOperation(tableName, 'create', resultKey, payload);
        });
      };
    });

    // 必须用 function 形式挂 onsuccess：等 update 事务真正提交后再记录操作，
    // 否则事务 abort（约束冲突等）会产生本地未生效、却被推送出去的幽灵 op。
    table.hook('updating', function (modifications, primaryKey, object, transaction) {
      if (!isRegistered()) {
        return;
      }

      const syncTransaction = transaction as SyncTransaction | undefined;
      if (syncTransaction?.source === 'sync') {
        return;
      }

      const updatedObject = { ...object, ...modifications, updatedAt: Date.now() };
      this.onsuccess = function () {
        queueMicrotask(() => {
          if (!isRegistered()) {
            return;
          }

          void recordOperation(tableName, 'update', primaryKey, updatedObject);
        });
      };
    });

    // 必须用 function 形式挂 onsuccess：等 delete 事务真正提交后再写墓碑、记录操作，
    // 否则事务 abort 会把仍存在的记录推成删除。
    table.hook('deleting', function (primaryKey, object, transaction) {
      if (!isRegistered()) {
        return;
      }

      const syncTransaction = transaction as SyncTransaction | undefined;
      if (syncTransaction?.source === 'sync') {
        return;
      }

      const now = Date.now();
      const updatedObject = { ...object, deletedAt: now, updatedAt: now };

      this.onsuccess = function () {
        queueMicrotask(() => {
          if (!isRegistered()) {
            return;
          }

          void (async () => {
            try {
              // 先落本地墓碑、再记录删除操作：墓碑写失败时绝不能推送删除，
              // 避免远端删了数据、本地却还保留活记录的漂移。
              await db.transaction('rw', [table], async (transaction) => {
                (transaction as SyncTransaction).source = 'sync';
                await table.put(updatedObject);
              });
              await recordOperation(tableName, 'delete', primaryKey, updatedObject);
            } catch (error) {
              logger.error(
                '[SyncEngine] Failed to soft-delete and record delete operation:',
                error
              );
            }
          })();
        });
      };
    });
  }
}
