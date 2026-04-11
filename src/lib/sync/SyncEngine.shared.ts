import type Dexie from 'dexie';
import type { Table, Transaction } from 'dexie';
import type { IndexableType } from 'dexie';
import type { SyncOperation } from './types';

export interface SyncTransaction extends Transaction {
  source?: 'sync';
}

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = (Math.random() * 16) | 0;
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getRecordTimestamp(record: unknown): number | null {
  if (typeof record === 'object' && record !== null) {
    const value = record as Record<string, unknown>;
    if (typeof value.updatedAt === 'number') {
      return value.updatedAt;
    }
  }

  return null;
}

export function resolvePayloadKey(
  table: Table<unknown, IndexableType>,
  op: SyncOperation
): Record<string, unknown> {
  let payload = op.payload as Record<string, unknown>;
  const keyPath = table.schema.primKey.keyPath;

  if (!keyPath) {
    return payload;
  }

  if (typeof keyPath === 'string') {
    if (payload[keyPath] === undefined && op.key !== undefined) {
      payload = { ...payload, [keyPath]: op.key };
    }
    return payload;
  }

  if (Array.isArray(keyPath)) {
    const keyArray = op.key as unknown[];
    if (Array.isArray(keyArray)) {
      for (let index = 0; index < keyPath.length; index++) {
        const path = keyPath[index];
        if (payload[path] === undefined && keyArray[index] !== undefined) {
          payload = { ...payload, [path]: keyArray[index] };
        }
      }
    }
  }

  return payload;
}

export async function resolveConstraintError(
  table: Table<unknown, IndexableType>,
  op: SyncOperation,
  payload: Record<string, unknown>,
  onConflictDelete?: (indexKeyPath: string, value: unknown) => void
) {
  for (const index of table.schema.indexes) {
    if (!index.unique) {
      continue;
    }

    const indexKeyPath = index.keyPath;
    if (!indexKeyPath || typeof indexKeyPath !== 'string') {
      continue;
    }

    const value = payload[indexKeyPath];
    if (value === undefined) {
      continue;
    }

    const conflict = await table
      .where(indexKeyPath)
      .equals(value as IndexableType)
      .first();
    if (!conflict) {
      continue;
    }

    const primaryKeyPath = table.schema.primKey.keyPath;
    if (typeof primaryKeyPath === 'string') {
      const conflictKey = (conflict as Record<string, unknown>)[primaryKeyPath];
      if (conflictKey !== op.key && conflictKey !== undefined) {
        onConflictDelete?.(indexKeyPath, value);
        await table.delete(conflictKey as IndexableType);
      }
    }
  }
}

export async function putWithConstraintRecovery(
  table: Table<unknown, IndexableType>,
  op: SyncOperation,
  payload: Record<string, unknown>,
  onConstraintError: (payload: Record<string, unknown>) => Promise<void>
) {
  try {
    await table.put(payload);
  } catch (error) {
    if (error instanceof Error && error.name === 'ConstraintError') {
      await onConstraintError(payload);
      await table.put(payload);
      return;
    }

    throw error;
  }
}

export async function deferOperation(
  db: Dexie,
  op: SyncOperation,
  onDeferred?: (table: string) => void,
  onError?: (table: string, error: unknown) => void
) {
  try {
    await db.table('deferred_ops').add({
      table: op.table,
      op,
      timestamp: op.timestamp,
      receivedAt: Date.now(),
    });
    onDeferred?.(op.table);
  } catch (error) {
    onError?.(op.table, error);
  }
}
