import type Dexie from 'dexie';
import type { DeferredOp, SyncApplyQueueRecord, SyncMetadata } from '@/db/typesSync';
import {
  type SyncChunkRecord,
  isSyncChunkOperation,
  mergeChunkRecords,
  reassembleChunkGroup,
  toSyncChunkRecord,
} from '@/lib/sync/chunks';
import { decryptOperation } from '@/lib/sync/crypto-helpers';
import {
  doesKeyRoleMatchScope,
  loadSyncKeyring,
  resolveKeyForKeyHash,
  resolveKeyRoleForKeyHash,
} from '@/lib/sync/syncKeys';
import { logger } from '@/utils/logger';
import {
  PENDING_DECRYPT_TABLE,
  archiveRemoteActivities,
  migrateDeferredChunks,
} from './SyncEngine.deferred';
import type { SyncTransaction } from './SyncEngine.shared';
import { resolveDataScope } from './dataScope';
import type { SyncOperation, SyncProvider } from './types';

interface PullFlowOptions {
  db: Dexie;
  tables: string[];
  provider: SyncProvider;
  ensureClientId: () => Promise<string>;
  withRetry: <T>(operation: () => Promise<T>, operationName: string) => Promise<T>;
  maxPullLoops: number;
  applyOperation: (op: SyncOperation) => Promise<void>;
}

export interface LocalSyncRecoveryOptions {
  db: Dexie;
  tables: string[];
  ensureClientId: () => Promise<string>;
  applyOperation: (op: SyncOperation) => Promise<void>;
}

function getOperationClientId(operation: SyncOperation): string | undefined {
  if (operation.clientId) return operation.clientId;
  if (!isSyncChunkOperation(operation)) return undefined;
  return operation.payload.clientId;
}

function getOriginalOperationId(operation: SyncOperation): string {
  return isSyncChunkOperation(operation) ? operation.payload.operationId : operation.id;
}

function isRemoteOperation(operation: SyncOperation, clientId: string): boolean {
  return getOperationClientId(operation) !== clientId;
}

async function getLocalOperationIds(db: Dexie, operations: SyncOperation[]): Promise<Set<string>> {
  const ids = Array.from(new Set(operations.map(getOriginalOperationId)));
  const localOperations = await Promise.all(ids.map((id) => db.table('operations').get(id)));
  return new Set(
    localOperations
      .filter((operation): operation is { id: string } => typeof operation?.id === 'string')
      .map((operation) => operation.id)
  );
}

function groupChunkRecords(records: SyncChunkRecord[]): Map<string, SyncChunkRecord[]> {
  const groups = new Map<string, SyncChunkRecord[]>();
  for (const record of records) {
    const group = groups.get(record.operationId) ?? [];
    group.push(record);
    groups.set(record.operationId, group);
  }
  return groups;
}

async function decryptAndValidate(
  operation: SyncOperation,
  keyring: Awaited<ReturnType<typeof loadSyncKeyring>>
): Promise<SyncOperation> {
  if (operation.table !== 'encrypted') {
    throw new Error(`[Sync] Refusing unencrypted remote operation ${operation.id}`);
  }
  const keyRole = resolveKeyRoleForKeyHash(operation.keyHash, keyring);
  const key = resolveKeyForKeyHash(operation.keyHash, keyring);
  if (!key || !keyRole) {
    throw new Error(
      `[Sync] Cannot decrypt op ${operation.id}: no matching key for keyHash=${operation.keyHash ?? 'none'}`
    );
  }

  try {
    const decrypted = await decryptOperation(operation, key);
    validateDecryptedOperation(decrypted);
    const scope = resolveDataScope(decrypted);
    if (!doesKeyRoleMatchScope(keyRole, scope)) {
      throw new Error(
        `[Sync] Cannot apply op ${operation.id}: keyRole=${keyRole} does not match scope=${scope} (table=${decrypted.table})`
      );
    }
    return decrypted;
  } catch (error) {
    logger.warn(`[Sync] Failed to decrypt op ${operation.id}; keeping it for retry:`, error);
    throw error;
  }
}

async function getCompleteChunkOperations(
  records: SyncChunkRecord[],
  keyring: Awaited<ReturnType<typeof loadSyncKeyring>>,
  clientId: string,
  includeLocalClient = false
): Promise<{
  operations: SyncOperation[];
  recordsToDelete: SyncChunkRecord[];
}> {
  const operations: SyncOperation[] = [];
  const recordsToDelete: SyncChunkRecord[] = [];

  for (const group of groupChunkRecords(records).values()) {
    const assembled = await reassembleChunkGroup(group);
    if (!assembled) continue;
    if (!includeLocalClient && assembled.operation.clientId === clientId) continue;

    try {
      const decrypted = await decryptAndValidate(assembled.operation, keyring);
      operations.push(decrypted);
      recordsToDelete.push(...assembled.records);
    } catch (error) {
      logger.warn(
        `[Sync] Failed to decrypt chunk group ${firstChunkId(group)}; keeping chunks for retry:`,
        error
      );
    }
  }

  return { operations, recordsToDelete };
}

function firstChunkId(records: SyncChunkRecord[]): string {
  return records[0]?.operationId ?? 'unknown';
}

async function processPendingDecryptionOperations(
  db: Dexie,
  keyring: Awaited<ReturnType<typeof loadSyncKeyring>>
): Promise<void> {
  const entries = (await db
    .table('deferred_ops')
    .where('table')
    .equals(PENDING_DECRYPT_TABLE)
    .sortBy('timestamp')) as DeferredOp[];
  const recovered: Array<{ entry: DeferredOp; operation: SyncOperation }> = [];

  for (const entry of entries) {
    try {
      recovered.push({ entry, operation: await decryptAndValidate(entry.op, keyring) });
    } catch (error) {
      logger.warn(`[Sync] Pending decrypt operation ${entry.op.id} is still unavailable:`, error);
    }
  }

  if (recovered.length === 0) return;

  await db.transaction('rw', [db.table('syncApplyQueue')], async () => {
    await db.table('syncApplyQueue').bulkPut(
      recovered.map(
        ({ operation }): SyncApplyQueueRecord => ({
          id: operation.id,
          operation,
          timestamp: operation.timestamp,
        })
      )
    );
  });
}

function getSyncMetadata(value: unknown): SyncMetadata {
  if (typeof value === 'object' && value !== null) {
    const candidate = value as Partial<SyncMetadata>;
    const cursor = candidate.lastServerCursor;
    if (
      cursor === undefined ||
      (typeof cursor === 'number' && Number.isSafeInteger(cursor) && cursor >= 0) ||
      (typeof cursor === 'string' && cursor.length > 0)
    ) {
      return value as SyncMetadata;
    }
  }
  return { id: 'global', lastSyncTimestamp: 0 };
}

function validateCursorTransition(
  cursor: string | number | undefined,
  nextCursor: string | number
): void {
  if (
    (typeof nextCursor === 'number' && (!Number.isSafeInteger(nextCursor) || nextCursor < 0)) ||
    (typeof nextCursor !== 'number' && typeof nextCursor !== 'string') ||
    (typeof nextCursor === 'string' && nextCursor.length === 0) ||
    (typeof cursor === 'number' && typeof nextCursor === 'number' && nextCursor < cursor)
  ) {
    throw new Error(
      `[Sync] Invalid pull cursor transition: ${String(cursor)} -> ${String(nextCursor)}`
    );
  }
}

function validateDecryptedOperation(operation: SyncOperation): void {
  if (
    operation.table === 'encrypted' ||
    typeof operation.table !== 'string' ||
    (operation.type !== 'create' && operation.type !== 'update' && operation.type !== 'delete') ||
    !Number.isFinite(operation.timestamp) ||
    operation.key === undefined ||
    typeof operation.payload !== 'object' ||
    operation.payload === null ||
    Array.isArray(operation.payload)
  ) {
    throw new Error(`[Sync] Invalid decrypted operation ${operation.id}`);
  }
}

async function processStoredChunks(
  db: Dexie,
  keyring: Awaited<ReturnType<typeof loadSyncKeyring>>,
  clientId: string,
  includeLocalClient = false
): Promise<boolean> {
  const records = (await db.table('syncChunks').toArray()) as SyncChunkRecord[];
  const complete = await getCompleteChunkOperations(records, keyring, clientId, includeLocalClient);
  if (complete.recordsToDelete.length === 0) return true;

  const operationIds = complete.operations.map((operation) => operation.id);
  const appliedIds = new Set(
    operationIds.length === 0
      ? []
      : await db.table('remoteActivityLog').where('id').anyOf(operationIds).primaryKeys()
  );
  const pendingOperations = complete.operations.filter(
    (operation) => !appliedIds.has(operation.id)
  );

  await db.transaction('rw', [db.table('syncChunks'), db.table('syncApplyQueue')], async () => {
    await db.table('syncApplyQueue').bulkPut(
      pendingOperations.map(
        (operation): SyncApplyQueueRecord => ({
          id: operation.id,
          operation,
          timestamp: operation.timestamp,
        })
      )
    );
    await db.table('syncChunks').bulkDelete(complete.recordsToDelete.map((record) => record.id));
  });

  return true;
}

async function flushApplyQueue(
  db: Dexie,
  tables: string[],
  applyOperation: (op: SyncOperation) => Promise<void>
): Promise<number> {
  const queued = (await db
    .table('syncApplyQueue')
    .orderBy('timestamp')
    .toArray()) as SyncApplyQueueRecord[];
  if (queued.length === 0) return 0;

  let appliedCount = 0;
  for (const entry of queued) {
    try {
      await db.transaction(
        'rw',
        [
          ...tables.map((table) => db.table(table)),
          db.table('settings'),
          db.table('deferred_ops'),
          db.table('syncApplyQueue'),
          db.table('remoteActivityLog'),
        ],
        async (transaction) => {
          (transaction as SyncTransaction).source = 'sync';
          await applyOperation(entry.operation);
          await archiveRemoteActivities(db, [entry.operation]);
          const pendingEntries = (await db
            .table('deferred_ops')
            .where('table')
            .equals(PENDING_DECRYPT_TABLE)
            .toArray()) as DeferredOp[];
          await db.table('deferred_ops').bulkDelete(
            pendingEntries
              .filter((pending) => pending.op.id === entry.operation.id)
              .map((pending) => pending.id)
              .filter((id): id is number => id !== undefined)
          );
          await db.table('syncApplyQueue').delete(entry.id);
        }
      );
      appliedCount++;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`[Sync] Quarantining failed operation ${entry.operation.id}:`, error);
      try {
        await db.transaction(
          'rw',
          [db.table('deferred_ops'), db.table('syncApplyQueue')],
          async () => {
            await db.table('deferred_ops').add({
              table: '__sync_quarantine__',
              op: entry.operation,
              timestamp: entry.operation.timestamp,
              receivedAt: Date.now(),
              error: errorMessage,
            });
            const pendingEntries = (await db
              .table('deferred_ops')
              .where('table')
              .equals(PENDING_DECRYPT_TABLE)
              .toArray()) as DeferredOp[];
            await db.table('deferred_ops').bulkDelete(
              pendingEntries
                .filter((pending) => pending.op.id === entry.operation.id)
                .map((pending) => pending.id)
                .filter((id): id is number => id !== undefined)
            );
            await db.table('syncApplyQueue').delete(entry.id);
          }
        );
      } catch (quarantineError) {
        logger.error(
          `[Sync] Failed to quarantine operation ${entry.operation.id}; keeping it queued:`,
          quarantineError
        );
      }
    }
  }

  return appliedCount;
}

export async function recoverLocalSyncData({
  db,
  tables,
  ensureClientId,
  applyOperation,
}: LocalSyncRecoveryOptions): Promise<number> {
  await migrateDeferredChunks(db);
  const keyring = await loadSyncKeyring();
  if (!keyring.teamKey && !keyring.personalKey) return 0;

  const clientId = await ensureClientId();
  await processStoredChunks(db, keyring, clientId);
  await processPendingDecryptionOperations(db, keyring);
  return await flushApplyQueue(db, tables, applyOperation);
}

async function recoverHistoricalChunks({
  db,
  provider,
  clientId,
  withRetry,
  maxPullLoops,
  keyring,
}: PullFlowOptions & {
  clientId: string;
  keyring: Awaited<ReturnType<typeof loadSyncKeyring>>;
}): Promise<boolean> {
  const state = getSyncMetadata(await db.table('syncMetadata').get('global'));
  let cursor = state.chunkRecoveryCursor ?? 0;
  let reachedEnd = false;

  for (let loop = 0; loop < maxPullLoops; loop++) {
    const { ops, nextCursor } = await withRetry(
      () => provider.pull(cursor),
      'Chunk history recovery'
    );
    validateCursorTransition(cursor, nextCursor);
    const incoming = ops
      .filter((operation) => isSyncChunkOperation(operation))
      .map((operation) => toSyncChunkRecord(operation))
      .filter((record): record is SyncChunkRecord => record !== null);
    const existing = (await db.table('syncChunks').toArray()) as SyncChunkRecord[];
    const merged = mergeChunkRecords(existing, incoming);
    for (const conflict of merged.conflicts) {
      logger.error(`[Sync] Conflicting historical chunk ignored: ${conflict.id}`);
    }

    await db.transaction('rw', [db.table('syncChunks'), db.table('syncMetadata')], async () => {
      const existingIds = new Set(existing.map((record) => record.id));
      for (const record of incoming) {
        if (!existingIds.has(record.id)) {
          await db.table('syncChunks').put(record);
          existingIds.add(record.id);
        }
      }
      const current = getSyncMetadata(await db.table('syncMetadata').get('global'));
      await db.table('syncMetadata').put({
        ...current,
        id: 'global',
        chunkRecoveryCursor: nextCursor,
        lastSyncTimestamp: Date.now(),
      });
    });

    const previousCursor = cursor;
    cursor = nextCursor;
    if (ops.length === 0 || nextCursor === previousCursor) {
      reachedEnd = true;
      break;
    }
  }

  const processed = await processStoredChunks(db, keyring, clientId, true);
  if (!processed || !reachedEnd) return false;

  const latest = getSyncMetadata(await db.table('syncMetadata').get('global'));
  await db.table('syncMetadata').put({
    ...latest,
    id: 'global',
    syncProtocolVersion: 2,
    chunkRecoveryCompleted: true,
    chunkRecoveryCursor: undefined,
    lastSyncTimestamp: Date.now(),
  });
  return true;
}

export async function runPullFlow({
  db,
  tables,
  provider,
  ensureClientId,
  withRetry,
  maxPullLoops,
  applyOperation,
}: PullFlowOptions): Promise<{ totalPulled: number; loopCount: number }> {
  const clientId = await ensureClientId();
  const keyring = await loadSyncKeyring();
  let totalPulled = 0;
  let loopCount = 0;
  let hasMore = true;

  if (!keyring.teamKey && !keyring.personalKey) {
    throw new Error(
      '[Sync] No encryption key found. Configure team sync key and/or personal key to decrypt pulled operations.'
    );
  }

  const initialState = getSyncMetadata(await db.table('syncMetadata').get('global'));
  await migrateDeferredChunks(db);
  const hasAdvancedCursor = Number(initialState.lastServerCursor ?? 0) > 0;
  if (
    hasAdvancedCursor &&
    (initialState.syncProtocolVersion !== 2 || initialState.chunkRecoveryCompleted !== true)
  ) {
    const recovered = await recoverHistoricalChunks({
      db,
      tables,
      provider,
      ensureClientId,
      withRetry,
      maxPullLoops,
      applyOperation,
      clientId,
      keyring,
    });
    if (!recovered) {
      throw new Error('[Sync] Historical chunk recovery is incomplete; normal pull is paused.');
    }
  } else if (initialState.syncProtocolVersion !== 2) {
    await db.table('syncMetadata').put({
      ...initialState,
      id: 'global',
      syncProtocolVersion: 2,
      chunkRecoveryCompleted: true,
      lastSyncTimestamp: Date.now(),
    });
  }

  if (!(await processStoredChunks(db, keyring, clientId))) {
    throw new Error('[Sync] Stored sync chunks could not be processed; pull is paused.');
  }
  await processPendingDecryptionOperations(db, keyring);
  totalPulled += await flushApplyQueue(db, tables, applyOperation);

  while (hasMore && loopCount < maxPullLoops) {
    loopCount++;
    const state = getSyncMetadata(await db.table('syncMetadata').get('global'));
    const cursor = state.lastServerCursor;
    const { ops, nextCursor } = await withRetry(() => provider.pull(cursor, clientId), 'Pull');
    validateCursorTransition(cursor, nextCursor);
    if (ops.length === 0) {
      await db.table('syncMetadata').put({
        ...state,
        id: 'global',
        lastServerCursor: nextCursor,
        lastSyncTimestamp: Date.now(),
      });
      hasMore = false;
      break;
    }

    const localOperationIds = await getLocalOperationIds(db, ops);
    const acknowledgedLocalIds = ops
      .map(getOriginalOperationId)
      .filter((id) => localOperationIds.has(id));
    const remoteOperations = ops.filter(
      (operation) =>
        !localOperationIds.has(getOriginalOperationId(operation)) &&
        isRemoteOperation(operation, clientId)
    );
    const incomingChunks = remoteOperations
      .filter((operation) => isSyncChunkOperation(operation))
      .map((operation) => toSyncChunkRecord(operation))
      .filter((record): record is SyncChunkRecord => record !== null);
    const existingChunks = (await db.table('syncChunks').toArray()) as SyncChunkRecord[];
    const mergedChunks = mergeChunkRecords(existingChunks, incomingChunks);
    for (const conflict of mergedChunks.conflicts) {
      logger.error(`[Sync] Conflicting chunk ignored: ${conflict.id}`);
    }

    const completeChunks = await getCompleteChunkOperations(
      mergedChunks.records,
      keyring,
      clientId
    );
    const pendingDecryptionOperations: SyncOperation[] = [];
    const normalOperations: SyncOperation[] = [];
    for (const operation of remoteOperations.filter(
      (candidate) => !isSyncChunkOperation(candidate)
    )) {
      try {
        normalOperations.push(await decryptAndValidate(operation, keyring));
      } catch (error) {
        logger.warn(`[Sync] Queuing undecryptable operation ${operation.id} for retry:`, error);
        pendingDecryptionOperations.push(operation);
      }
    }
    const validOperations = [
      ...normalOperations.filter((operation): operation is SyncOperation => operation !== null),
      ...completeChunks.operations,
    ].sort((left, right) => left.timestamp - right.timestamp);

    const existingIds = new Set(existingChunks.map((record) => record.id));
    await db.transaction(
      'rw',
      [
        db.table('syncChunks'),
        db.table('syncApplyQueue'),
        db.table('syncMetadata'),
        db.table('operations'),
        db.table('deferred_ops'),
      ],
      async (transaction) => {
        (transaction as SyncTransaction).source = 'sync';
        if (acknowledgedLocalIds.length > 0) {
          await db
            .table('operations')
            .where('id')
            .anyOf(Array.from(new Set(acknowledgedLocalIds)))
            .modify({ synced: 1, encryptedPayload: undefined, payload: undefined });
        }
        for (const record of incomingChunks) {
          if (!existingIds.has(record.id)) {
            await db.table('syncChunks').put(record);
            existingIds.add(record.id);
          }
        }
        const pendingEntries = (await db
          .table('deferred_ops')
          .where('table')
          .equals(PENDING_DECRYPT_TABLE)
          .toArray()) as DeferredOp[];
        const pendingIds = new Set(pendingEntries.map((entry) => entry.op.id));
        for (const operation of pendingDecryptionOperations) {
          if (pendingIds.has(operation.id)) continue;
          await db.table('deferred_ops').add({
            table: PENDING_DECRYPT_TABLE,
            op: operation,
            timestamp: operation.timestamp,
            receivedAt: Date.now(),
          });
          pendingIds.add(operation.id);
        }
        await db.table('syncApplyQueue').bulkPut(
          validOperations.map(
            (operation): SyncApplyQueueRecord => ({
              id: operation.id,
              operation,
              timestamp: operation.timestamp,
            })
          )
        );
        await db
          .table('syncChunks')
          .bulkDelete(completeChunks.recordsToDelete.map((record) => record.id));

        const current = getSyncMetadata(await db.table('syncMetadata').get('global'));
        await db.table('syncMetadata').put({
          ...current,
          id: 'global',
          lastServerCursor: nextCursor,
          syncProtocolVersion: 2,
          chunkRecoveryCompleted: true,
          lastSyncTimestamp: Date.now(),
        });
      }
    );

    if (nextCursor === cursor) {
      hasMore = false;
    }
  }

  if (!(await processStoredChunks(db, keyring, clientId))) {
    throw new Error('[Sync] Stored sync chunks could not be processed; pull is paused.');
  }
  await processPendingDecryptionOperations(db, keyring);
  totalPulled += await flushApplyQueue(db, tables, applyOperation);

  if (loopCount >= maxPullLoops) {
    logger.warn(`[Sync] Pull reached max loops (${maxPullLoops}), stopping.`);
  }

  return { totalPulled, loopCount };
}
