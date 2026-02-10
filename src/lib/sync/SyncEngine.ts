import Dexie from 'dexie';
import type { IndexableType } from 'dexie';
import { getKeyHash, loadKey } from '@/lib/crypto/encryption';
import { decryptOperation } from '@/lib/sync/crypto-helpers';
import { logger } from '@/utils/logger';
import type {
  OperationType,
  SyncMetadata,
  SyncOperation,
  SyncPendingCounts,
  SyncProvider,
  SyncStatus,
} from './types';

export interface SyncEngineOptions {
  maxRetries?: number;
  baseRetryDelay?: number;
}

type SyncEventType = 'status-change' | 'sync-error' | 'sync-complete';
type SyncEventCallback = (data: unknown) => void;

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class SyncEngine {
  private db: Dexie;
  private tables: string[];
  private provider: SyncProvider;

  /**
   * Unified synchronization lock to prevent concurrent push/pull operations
   * This replaces the separate isSyncing and isPushing flags to prevent race conditions
   */
  private syncLock = false;

  private clientId: string | null = null;

  private maxRetries: number;
  private baseRetryDelay: number;

  private eventListeners: Map<SyncEventType, Set<SyncEventCallback>> = new Map();

  private _status: SyncStatus = 'idle';
  private _lastError: string | null = null;
  private _lastSyncTime: number | null = null;

  // Split large pushes into smaller chunks to improve reliability on poor networks
  private readonly PUSH_BATCH_SIZE = 50;

  // Max number of consecutive pull batches to prevent infinite loops
  private readonly MAX_PULL_LOOPS = 100;

  constructor(
    db: Dexie,
    tables: string[],
    provider: SyncProvider,
    options: SyncEngineOptions = {}
  ) {
    this.db = db;
    this.tables = tables;
    this.provider = provider;
    this.maxRetries = options.maxRetries ?? 5;
    this.baseRetryDelay = options.baseRetryDelay ?? 1000;
  }

  get status(): SyncStatus {
    return this._status;
  }

  get lastError(): string | null {
    return this._lastError;
  }

  get lastSyncTime(): number | null {
    return this._lastSyncTime;
  }

  async getClientId(): Promise<string> {
    return await this.ensureClientId();
  }

  private async ensureClientId(): Promise<string> {
    if (this.clientId) {
      return this.clientId;
    }

    const setting = await this.db.table('settings').get('sync_client_id');
    if (setting?.value) {
      this.clientId = setting.value as string;
      return this.clientId;
    }

    const newClientId = generateUUID();
    await this.db.table('settings').put({ key: 'sync_client_id', value: newClientId });
    this.clientId = newClientId;
    return this.clientId;
  }

  public on(event: SyncEventType, callback: SyncEventCallback): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    const listeners = this.eventListeners.get(event);
    listeners?.add(callback);

    return () => {
      this.eventListeners.get(event)?.delete(callback);
    };
  }

  private emit(event: SyncEventType, data: unknown) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      for (const cb of listeners) {
        cb(data);
      }
    }
  }

  private setStatus(status: SyncStatus, error?: string) {
    this._status = status;
    if (error) {
      this._lastError = error;
    } else if (status === 'idle') {
      this._lastError = null;
    }
    this.emit('status-change', { status, error });
  }

  private async withRetry<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const delay = this.baseRetryDelay * 2 ** attempt;

        logger.warn(
          `[Sync] ${operationName} failed (attempt ${attempt + 1}/${this.maxRetries}), ` +
            `retrying in ${delay}ms:`,
          lastError.message
        );

        if (attempt < this.maxRetries - 1) {
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  public register() {
    // Trigger deferred operations processing on startup
    this.processDeferredOperations().catch((e) => {
      logger.error('[Sync] Failed to process deferred operations on startup:', e);
    });

    for (const tableName of this.tables) {
      const table = this.db.table(tableName);

      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const self = this;

      // biome-ignore lint/complexity/useArrowFunction: Dexie hook requires function for this.onsuccess binding
      table.hook('creating', function (_primKey, obj, transaction) {
        // @ts-expect-error - Check for transaction source tag to identify sync operations
        if (transaction?.source === 'sync') return;
        const now = Date.now();
        const objWithTimestamp = { ...obj, updatedAt: now };
        // biome-ignore lint/complexity/useArrowFunction: Dexie hook requires function for this.onsuccess binding
        this.onsuccess = function (resultKey: unknown) {
          queueMicrotask(() => {
            let payload = objWithTimestamp;
            if (_primKey === undefined && resultKey !== undefined) {
              payload = { ...objWithTimestamp, id: resultKey };
            }
            self.recordOperation(tableName, 'create', resultKey, payload);
          });
        };
      });

      table.hook('updating', (modifications, primKey, obj, transaction) => {
        // @ts-expect-error - Check for transaction source tag to identify sync operations
        if (transaction?.source === 'sync') return;
        const now = Date.now();
        const newObj = { ...obj, ...modifications, updatedAt: now };
        queueMicrotask(() => {
          this.recordOperation(tableName, 'update', primKey, newObj);
        });
      });

      // biome-ignore lint/complexity/useArrowFunction: Dexie hook requires function for async operations
      table.hook('deleting', function (primKey, obj, transaction) {
        // @ts-expect-error - Check for transaction source tag to identify sync operations
        if (transaction?.source === 'sync') return;
        const now = Date.now();

        queueMicrotask(async () => {
          const updated = { ...obj, deletedAt: now, updatedAt: now };
          await table.put(updated);
          self.recordOperation(tableName, 'delete', primKey, updated);
        });

        return false;
      });
    }
  }

  public async recordOperation(table: string, type: OperationType, key: unknown, payload: unknown) {
    const clientId = await this.ensureClientId();
    const op: SyncOperation = {
      id: generateUUID(),
      clientId,
      table,
      type,
      key,
      payload,
      timestamp: Date.now(),
      synced: 0,
    };

    try {
      await this.db.table('operations').add(op);
    } catch (e) {
      logger.error(`[Sync] Failed to record operation for ${table}:`, e);
    }
  }

  /**
   * Push local operations to the server
   * Uses unified syncLock to prevent concurrent sync operations
   *
   * Intelligently updates syncMetadata cursor based on push result:
   * - If serverCursor === currentCursor + batchSize: Safe to update (optimization)
   * - If serverCursor > currentCursor + batchSize: Remote changes exist, skip update
   * - If serverCursor < currentCursor + batchSize: Anomaly, skip update (logged as debug)
   */
  public async push() {
    // Check if any sync operation is in progress
    if (this.syncLock) {
      logger.warn('[Sync] Sync already in progress, skipping push');
      return;
    }

    try {
      this.syncLock = true;
      this.setStatus('pushing');

      const clientId = await this.ensureClientId();

      const ops = (await this.db
        .table('operations')
        .where('synced')
        .equals(0)
        .toArray()) as SyncOperation[];

      if (ops.length === 0) {
        this.setStatus('idle');
        return;
      }

      // Process in batches
      for (let i = 0; i < ops.length; i += this.PUSH_BATCH_SIZE) {
        const batch = ops.slice(i, i + this.PUSH_BATCH_SIZE);
        const result = await this.withRetry(
          () => this.provider.push(batch, clientId),
          `Push batch ${Math.floor(i / this.PUSH_BATCH_SIZE) + 1}`
        );

        const updates = batch.map((op) => ({ ...op, synced: 1 }));
        await this.db.table('operations').bulkPut(updates);

        // Intelligent cursor update with safety checks
        if (result?.cursor !== undefined && result.cursor !== null) {
          await this.db.transaction('rw', this.db.table('syncMetadata'), async () => {
            const currentMeta = await this.db.table('syncMetadata').get('global');
            const currentCursor = Number(currentMeta?.lastServerCursor || 0);
            const serverReturnedCursor = Number(result.cursor);
            const expectedCursor = currentCursor + batch.length;

            if (serverReturnedCursor === expectedCursor) {
              // Safe optimization: Server state matches exactly (current state + my ops)
              // This prevents re-pulling our own just-pushed changes
              await this.db.table('syncMetadata').put({
                id: 'global',
                lastServerCursor: serverReturnedCursor,
                lastSyncTimestamp: Date.now(),
              });
              logger.debug(
                `[Sync] Push optimization: Updated cursor ${currentCursor} → ${serverReturnedCursor}`
              );
            } else if (serverReturnedCursor > expectedCursor) {
              // Gap detected: Remote changes exist (from other clients)
              // Do NOT update cursor; rely on subsequent pull to fetch intervening changes
              logger.debug(
                `[Sync] Push optimization skipped: remote gap detected (server=${serverReturnedCursor} > expected=${expectedCursor}). Will pull to catch up.`
              );
            } else {
              // serverReturnedCursor < expectedCursor: Anomaly (server behind?)
              // Log for debugging but don't update; let pull catch up
              logger.debug(
                `[Sync] Push anomaly: server cursor behind expected (server=${serverReturnedCursor} < expected=${expectedCursor}, current=${currentCursor}). Skipping cursor update.`
              );
            }
          });
        }
      }

      this._lastSyncTime = Date.now();
      this.setStatus('idle');
      this.emit('sync-complete', { type: 'push', count: ops.length });
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      logger.error('[Sync] Push failed after retries:', errorMsg);
      this.setStatus('error', errorMsg);
      this.emit('sync-error', { type: 'push', error: errorMsg });
    } finally {
      this.syncLock = false;
    }
  }

  /**
   * Pull remote operations from the server
   * Uses unified syncLock to prevent concurrent sync operations
   */
  public async pull() {
    // Check if any sync operation is in progress
    if (this.syncLock) {
      logger.warn('[Sync] Sync already in progress, skipping pull');
      return;
    }

    try {
      this.syncLock = true;
      this.setStatus('pulling');

      const clientId = await this.ensureClientId();
      let keyCache: { key: CryptoKey; keyHash: string } | null = null;

      const ensureKey = async () => {
        if (keyCache) return keyCache;
        const key = await loadKey();
        if (!key) {
          throw new Error('[Sync] Encryption key not found. Cannot decrypt pulled operations.');
        }
        keyCache = { key, keyHash: await getKeyHash(key) };
        return keyCache;
      };

      let totalPulled = 0;
      let loopCount = 0;
      let hasMore = true;

      while (hasMore && loopCount < this.MAX_PULL_LOOPS) {
        loopCount++;
        const state = (await this.db.table('syncMetadata').get('global')) as
          | SyncMetadata
          | undefined;
        const cursor = state?.lastServerCursor;

        const { ops, nextCursor } = await this.withRetry(
          () => this.provider.pull(cursor, clientId),
          'Pull'
        );

        if (ops.length === 0) {
          hasMore = false;
          break;
        }

        const remoteOps = ops.filter((op) => op.clientId !== clientId);

        if (remoteOps.length > 0) {
          const { key, keyHash: currentKeyHash } = await ensureKey();

          const decryptedOps = await Promise.all(
            remoteOps.map(async (op) => {
              if (op.keyHash && op.keyHash !== currentKeyHash) {
                logger.debug(
                  `[Sync] Skipping op ${op.id} due to keyHash mismatch (expected ${currentKeyHash}, got ${op.keyHash})`
                );
                return null;
              }

              // If no keyHash (legacy data), try to decrypt anyway (might fail)
              try {
                return await decryptOperation(op, key);
              } catch (e) {
                logger.warn(`[Sync] Failed to decrypt op ${op.id}, skipping:`, e);
                return null;
              }
            })
          );

          // Filter out nulls
          const validOps = decryptedOps.filter((op): op is SyncOperation => op !== null);

          await this.db.transaction(
            'rw',
            [...this.tables.map((t) => this.db.table(t)), this.db.table('syncMetadata')],
            async (tx) => {
              // @ts-expect-error - Tag transaction to prevent echoing these ops
              tx.source = 'sync';

              for (const op of validOps) {
                await this.applyOperation(op);
              }

              await this.db.table('syncMetadata').put({
                id: 'global',
                lastServerCursor: nextCursor,
                lastSyncTimestamp: Date.now(),
              });
            }
          );
          totalPulled += validOps.length;
        } else {
          // Even if no ops (e.g. filtered out echoes), update cursor to advance
          await this.db.table('syncMetadata').put({
            id: 'global',
            lastServerCursor: nextCursor,
            lastSyncTimestamp: Date.now(),
          });
        }

        // Safety check: if cursor didn't move, assume we're done or server is stuck
        if (nextCursor === cursor) {
          hasMore = false;
        }
      }

      if (loopCount >= this.MAX_PULL_LOOPS) {
        logger.warn(`[Sync] Pull reached max loops (${this.MAX_PULL_LOOPS}), stopping.`);
      }

      if (totalPulled > 0 || loopCount > 0) {
        this._lastSyncTime = Date.now();
        this.setStatus('idle');
        this.emit('sync-complete', { type: 'pull', count: totalPulled });
      } else {
        this.setStatus('idle');
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      logger.error('[Sync] Pull failed after retries:', errorMsg);
      this.setStatus('error', errorMsg);
      this.emit('sync-error', { type: 'pull', error: errorMsg });
    } finally {
      this.syncLock = false;
    }
  }

  private async applyOperation(op: SyncOperation) {
    if (!this.tables.includes(op.table)) {
      // Defer operation for unknown table to support future schema updates
      try {
        await this.db.table('deferred_ops').add({
          table: op.table,
          op,
          timestamp: op.timestamp,
          receivedAt: Date.now(),
        });
        logger.info(`[Sync] Deferred operation for unknown table: ${op.table}`);
      } catch (e) {
        logger.error(`[Sync] Failed to defer operation for ${op.table}:`, e);
      }
      return;
    }

    const table = this.db.table(op.table);

    if (op.type === 'delete') {
      const payload = op.payload as Record<string, unknown>;
      if (payload && typeof payload === 'object') {
        await table.put(payload);
      }
    } else if (op.type === 'create' || op.type === 'update') {
      const existing = await table.get(op.key as IndexableType);

      if (existing) {
        const existingTimestamp = this.getRecordTimestamp(existing);
        const opTimestamp = op.serverTimestamp ?? op.timestamp;
        if (existingTimestamp && existingTimestamp > opTimestamp) {
          return;
        }
      }

      let payload = op.payload as Record<string, unknown>;
      const keyPath = table.schema.primKey.keyPath;

      if (keyPath) {
        if (typeof keyPath === 'string') {
          if (payload[keyPath] === undefined && op.key !== undefined) {
            payload = { ...payload, [keyPath]: op.key };
          }
        } else if (Array.isArray(keyPath)) {
          const keyArray = op.key as unknown[];
          if (Array.isArray(keyArray)) {
            keyPath.forEach((path, index) => {
              if (payload[path] === undefined && keyArray[index] !== undefined) {
                payload = { ...payload, [path]: keyArray[index] };
              }
            });
          }
        }
      }

      try {
        await table.put(payload);
      } catch (err) {
        if (err instanceof Error && err.name === 'ConstraintError') {
          for (const index of table.schema.indexes) {
            if (!index.unique) continue;
            const indexKeyPath = index.keyPath;
            if (!indexKeyPath || typeof indexKeyPath !== 'string') continue;
            const value = payload[indexKeyPath];
            if (value === undefined) continue;

            const conflict = await table
              .where(indexKeyPath)
              .equals(value as IndexableType)
              .first();
            if (!conflict) continue;

            const pkPath = table.schema.primKey.keyPath;
            if (typeof pkPath === 'string') {
              const conflictKey = (conflict as Record<string, unknown>)[pkPath];
              if (conflictKey !== op.key && conflictKey !== undefined) {
                logger.info(
                  `[Sync] Deleting conflicting record in ${op.table} (${indexKeyPath}=${value})`
                );
                await table.delete(conflictKey as IndexableType);
              }
            }
          }
          await table.put(payload);
        } else {
          throw err;
        }
      }
    }
  }

  private getRecordTimestamp(record: unknown): number | null {
    if (typeof record === 'object' && record !== null) {
      const r = record as Record<string, unknown>;
      if (typeof r.serverTimestamp === 'number') return r.serverTimestamp;
      if (typeof r.updatedAt === 'number') return r.updatedAt;
    }
    return null;
  }

  public destroy() {
    this.eventListeners.clear();
  }

  public async getPendingCounts(): Promise<SyncPendingCounts> {
    // Skip if sync is in progress to avoid interfering
    if (this.syncLock) {
      return { push: 0, pull: 0 };
    }

    const pushCount = await this.db.table('operations').where('synced').equals(0).count();

    let pullCount = 0;
    if (this.provider.getPendingCount) {
      try {
        const clientId = await this.ensureClientId();
        const state = (await this.db.table('syncMetadata').get('global')) as
          | SyncMetadata
          | undefined;
        const cursor = state?.lastServerCursor;
        pullCount = await this.provider.getPendingCount(cursor, clientId);
      } catch (e) {
        logger.warn('[Sync] Failed to get remote pending count:', e);
      }
    }

    return { push: pushCount, pull: pullCount };
  }

  /**
   * Reset sync state and regenerate create operations for all local data.
   * This is used when the encryption key changes, to re-encrypt all data with the new key.
   */
  public async resetAndRegenerateOperations() {
    // 1. Stop any ongoing sync
    if (this.syncLock) {
      throw new Error('Cannot reset sync while sync is in progress');
    }

    try {
      this.syncLock = true;
      this.setStatus('idle'); // Ensure status is clear

      // 2. Clear sync metadata and existing operations
      await this.db.transaction(
        'rw',
        this.db.table('syncMetadata'),
        this.db.table('operations'),
        this.db.table('deferred_ops'),
        async () => {
          await this.db.table('syncMetadata').clear();
          await this.db.table('operations').clear();
          await this.db.table('deferred_ops').clear();

          // Reset local cursor state in memory if needed (though it's read from DB)
          this._lastSyncTime = null;
          this._lastError = null;
        }
      );

      logger.info('[Sync] Sync state reset. Regenerating operations...');

      // 3. Regenerate create operations for all tables
      for (const tableName of this.tables) {
        const table = this.db.table(tableName);
        const items = await table.toArray();
        const primKeyPath = table.schema.primKey.keyPath;

        const ops: SyncOperation[] = [];

        for (const item of items) {
          let key: unknown;
          if (typeof primKeyPath === 'string') {
            key = item[primKeyPath as keyof typeof item];
          } else if (Array.isArray(primKeyPath)) {
            key = primKeyPath.map((k) => item[k as keyof typeof item]);
          }

          // Construct operation manually to batch add
          const op: SyncOperation = {
            id: generateUUID(),
            clientId: await this.ensureClientId(),
            table: tableName,
            type: 'create',
            key,
            payload: item,
            timestamp: Date.now(),
            synced: 0,
          };
          ops.push(op);
        }

        if (ops.length > 0) {
          await this.db.table('operations').bulkAdd(ops);
          logger.info(`[Sync] Regenerated ${ops.length} operations for table ${tableName}`);
        }
      }

      logger.info('[Sync] Operations regeneration complete.');
    } catch (e) {
      logger.error('[Sync] Failed to reset and regenerate operations:', e);
      throw e;
    } finally {
      this.syncLock = false;
    }
  }

  /**
   * Process any deferred operations for tables that are now supported
   * This handles the case where data was received before the schema was updated
   */
  public async processDeferredOperations() {
    try {
      // Get all table names that have deferred operations
      const deferredTables = await this.db.table('deferred_ops').orderBy('table').uniqueKeys();

      // Filter for tables that are now known/supported
      const tablesToProcess = deferredTables.filter((tableName) =>
        this.tables.includes(tableName as string)
      );

      if (tablesToProcess.length === 0) return;

      logger.info(
        `[Sync] Processing deferred operations for new tables: ${tablesToProcess.join(', ')}`
      );

      for (const tableName of tablesToProcess) {
        // Process each table in its own transaction to prevent one bad table from blocking others
        // and to avoid massive transactions that could lock the DB
        try {
          await this.db.transaction(
            'rw',
            [this.db.table('deferred_ops'), this.db.table(tableName as string)],
            async (tx) => {
              // @ts-expect-error - Tag transaction to prevent echoing these ops
              tx.source = 'sync';

              // Get ops sorted by timestamp to ensure correct replay order
              const entries = await this.db
                .table('deferred_ops')
                .where('table')
                .equals(tableName)
                .sortBy('timestamp');

              for (const entry of entries) {
                try {
                  // Apply the original operation
                  await this.applyOperation(entry.op);
                } catch (opError) {
                  // Poison pill protection: if a specific operation fails, log it and continue.
                  // This ensures that one bad record doesn't block the entire queue forever.
                  logger.error(
                    `[Sync] Failed to apply deferred op for ${tableName} (id: ${entry.op.id}), skipping:`,
                    opError
                  );
                }
              }

              // Clean up processed operations for this table
              // We delete them even if some failed individually (poison pills),
              // because we don't want to retry them forever on every startup.
              await this.db.table('deferred_ops').where('table').equals(tableName).delete();
            }
          );
          logger.info(`[Sync] Successfully processed deferred operations for ${tableName}`);
        } catch (tableError) {
          logger.error(`[Sync] Failed to process deferred table ${tableName}:`, tableError);
        }
      }
    } catch (e) {
      logger.error('[Sync] Failed to process deferred operations:', e);
    }
  }
}
