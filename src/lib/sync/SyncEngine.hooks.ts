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
        // 嵌套事务共用底层 IDB 事务，必须等最外层提交后才记录同步操作。
        transaction.idbtrans.addEventListener(
          'complete',
          () => {
            if (!isRegistered()) {
              return;
            }

            let payload = objectWithTimestamp;
            if (_primKey === undefined && resultKey !== undefined) {
              payload = { ...objectWithTimestamp, id: resultKey };
            }

            void recordOperation(tableName, 'create', resultKey, payload);
          },
          { once: true }
        );
      };
    });

    // 单条请求成功后事务仍可能回滚，必须同时等待底层事务提交。
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
        transaction.idbtrans.addEventListener(
          'complete',
          () => {
            if (!isRegistered()) {
              return;
            }

            void recordOperation(tableName, 'update', primaryKey, updatedObject);
          },
          { once: true }
        );
      };
    });

    // return false 会同步取消硬删除；取消后没有 IDB 请求，也就不会有 onsuccess，
    // 因此墓碑与操作记录在微任务里执行（取消是同步确定的，无需等待提交）。
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
            logger.error('[SyncEngine] Failed to soft-delete and record delete operation:', error);
          }
        })();
      });

      return false;
    });
  }
}
