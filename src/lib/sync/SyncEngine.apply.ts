import type Dexie from 'dexie';
import type { Table } from 'dexie';
import type { IndexableType } from 'dexie';
import { logger } from '@/utils/logger';
import {
  deferOperation,
  getRecordTimestamp,
  putWithConstraintRecovery,
  resolveConstraintError,
  resolvePayloadKey,
} from './SyncEngine.shared';
import type { SyncOperation } from './types';

interface ApplyOperationOptions {
  db: Dexie;
  tables: string[];
}

export async function applySyncOperation(
  options: ApplyOperationOptions,
  op: SyncOperation
): Promise<void> {
  if (!options.tables.includes(op.table)) {
    await deferOperation(
      options.db,
      op,
      (table) => logger.info(`[Sync] Deferred operation for unknown table: ${table}`),
      (table, error) => logger.error(`[Sync] Failed to defer operation for ${table}:`, error)
    );
    return;
  }

  const table = options.db.table(op.table) as Table<unknown, IndexableType>;
  if (op.type === 'delete') {
    await applyDeleteOperation(table, op);
    return;
  }

  if (op.type === 'create' || op.type === 'update') {
    await applyCreateOrUpdateOperation(table, op);
  }
}

async function applyDeleteOperation(table: Table<unknown, IndexableType>, op: SyncOperation) {
  const payload = op.payload as Record<string, unknown>;
  if (payload && typeof payload === 'object') {
    await table.put(payload);
  }
}

async function applyCreateOrUpdateOperation(
  table: Table<unknown, IndexableType>,
  op: SyncOperation
) {
  const existing = await table.get(op.key as IndexableType);

  if (existing) {
    const existingTimestamp = getRecordTimestamp(existing);
    const operationTimestamp = op.timestamp;
    if (existingTimestamp && existingTimestamp > operationTimestamp) {
      logger.info(
        `[Sync] Conflict detected for ${op.table}[${op.key}]: ` +
          `local timestamp (${existingTimestamp}) > remote timestamp (${operationTimestamp}). ` +
          `Remote ${op.type} operation skipped to preserve local data. ` +
          `Consider reconciling manually if local data is stale.`
      );
      return;
    }
  }

  const payload = resolvePayloadKey(table, op);
  await putWithConstraintRecovery(table, op, payload, async (resolvedPayload) => {
    await resolveConstraintError(table, op, resolvedPayload, (indexKeyPath, value) => {
      logger.info(`[Sync] Deleting conflicting record in ${op.table} (${indexKeyPath}=${value})`);
    });
  });
}
