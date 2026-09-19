import Dexie from 'dexie';
import type { Table } from 'dexie';
import type { IndexableType } from 'dexie';
import type {
  TestProject,
  TestProjectRun,
  TestRun,
} from '@/features/aiAssistant/materials/testCaseTypes';
import { trackSync } from '@/lib/analytics';
import { logger } from '@/utils/logger';
import {
  deferOperation,
  getRecordTimestamp,
  putWithConstraintRecovery,
  resolveConstraintError,
  resolvePayloadKey,
} from './SyncEngine.shared';
import { mergeTestProjectRecords } from './testProjectMerge';
import { mergeTestProjectRunRecords } from './testProjectRunMerge';
import { mergeTestRunRecords } from './testRunMerge';
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
  if (op.table === 'materials' && isRoleMaterialPayload(op.payload)) {
    logger.warn(`[Sync] Ignoring role deletion operation for ${op.key}`);
    return;
  }

  const existing = await table.get(op.key as IndexableType);
  if (isImmutableConversation(existing)) {
    logger.warn(`[Sync] Ignoring deletion of immutable conversation material ${op.key}`);
    return;
  }
  if (existing) {
    const existingTimestamp = getRecordTimestamp(existing);
    if (existingTimestamp && existingTimestamp > op.timestamp) {
      logger.info(
        `[Sync] Skipping stale delete for ${op.table}[${op.key}]: ` +
          `local timestamp (${existingTimestamp}) > remote timestamp (${op.timestamp})`
      );
      trackSync('conflictResolved', { meta: { strategy: 'lww' } });
      return;
    }
  }

  const payload = op.payload as Record<string, unknown>;
  if (payload && typeof payload === 'object') {
    await table.put(payload);
  }
}

function isRoleMaterialPayload(payload: unknown): boolean {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    (payload as { type?: unknown }).type === 'role'
  );
}

async function applyCreateOrUpdateOperation(
  table: Table<unknown, IndexableType>,
  op: SyncOperation
) {
  const existing = await table.get(op.key as IndexableType);

  if (isImmutableConversation(existing)) {
    logger.warn(`[Sync] Ignoring update of immutable conversation material ${op.key}`);
    return;
  }

  const payload = resolvePayloadKey(table, op);
  if (op.table === 'testProjects' && existing) {
    const merged = await Dexie.waitFor(
      mergeTestProjectRecords(existing as TestProject, payload as unknown as TestProject)
    );
    await table.put(merged);
    trackSync('conflictResolved', { meta: { strategy: 'merge' } });
    return;
  }
  if (op.table === 'testRuns' && existing) {
    const merged = await Dexie.waitFor(
      mergeTestRunRecords(existing as TestRun, payload as unknown as TestRun)
    );
    await table.put(merged);
    trackSync('conflictResolved', { meta: { strategy: 'merge' } });
    return;
  }
  if (op.table === 'projectRuns' && existing) {
    const merged = await Dexie.waitFor(
      mergeTestProjectRunRecords(existing as TestProjectRun, payload as unknown as TestProjectRun)
    );
    await table.put(merged);
    trackSync('conflictResolved', { meta: { strategy: 'merge' } });
    return;
  }

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
      trackSync('conflictResolved', { meta: { strategy: 'lww' } });
      return;
    }
  }

  await putWithConstraintRecovery(table, op, payload, async (resolvedPayload) => {
    await resolveConstraintError(table, op, resolvedPayload, (indexKeyPath, value) => {
      logger.info(`[Sync] Deleting conflicting record in ${op.table} (${indexKeyPath}=${value})`);
      trackSync('conflictResolved', { meta: { strategy: 'constraint' } });
    });
  });
}

function isImmutableConversation(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { type?: unknown; immutable?: unknown }).type === 'conversation' &&
    (value as { type?: unknown; immutable?: unknown }).immutable === true
  );
}
