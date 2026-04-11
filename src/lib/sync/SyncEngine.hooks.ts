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

    table.hook('updating', (modifications, primaryKey, object, transaction) => {
      if (!isRegistered()) {
        return;
      }

      const syncTransaction = transaction as SyncTransaction | undefined;
      if (syncTransaction?.source === 'sync') {
        return;
      }

      const updatedObject = { ...object, ...modifications, updatedAt: Date.now() };
      queueMicrotask(() => {
        if (!isRegistered()) {
          return;
        }

        void recordOperation(tableName, 'update', primaryKey, updatedObject);
      });
    });

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
            await table.put(updatedObject);
            await recordOperation(tableName, 'delete', primaryKey, updatedObject);
          } catch (error) {
            logger.error('[SyncEngine] Failed to record delete operation:', error);
          }
        })();
      });

      return false;
    });
  }
}
