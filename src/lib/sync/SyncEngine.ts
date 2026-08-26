import Dexie from 'dexie';
import { loadPersonalKey } from '@/lib/crypto/personalKey';
import { logger } from '@/utils/logger';
import { applySyncOperation } from './SyncEngine.apply';
import {
  clearAllSyncData,
  getSyncPendingCounts,
  migrateDeferredChunks,
  processDeferredOperations,
  regenerateSyncOperations,
  resetSyncState,
} from './SyncEngine.maintenance';
import {
  recordSyncOperation,
  registerSyncEngine,
  runSyncCommand,
} from './SyncEngine.orchestration';
import { processSyncOperationRecovery } from './SyncEngine.recovery';
import {
  SyncEventBus,
  type SyncEventCallback,
  type SyncEventType,
  applySyncStatus,
  ensureSyncClientId,
  runWithSyncRetry,
} from './SyncEngine.runtime';
import { recoverLocalSyncData, runPullFlow, runPushFlow } from './SyncEngine.sync';
import { enqueuePersonalSyncData } from './enqueuePersonalData';
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

export class SyncEngine {
  private db: Dexie;
  private tables: string[];
  private provider: SyncProvider;
  private syncLock = false;
  private clientId: string | null = null;
  private maxRetries: number;
  private baseRetryDelay: number;
  private eventBus = new SyncEventBus();
  private _status: SyncStatus = 'idle';
  private _lastError: string | null = null;
  private _lastSyncTime: number | null = null;
  private startupReady: Promise<void> = Promise.resolve();
  private readonly PUSH_BATCH_SIZE = 50;
  private readonly MAX_PULL_LOOPS = 100;
  private _registered = false;

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
    return ensureSyncClientId({
      db: this.db,
      currentClientId: this.clientId,
      setClientId: (value) => {
        this.clientId = value;
      },
    });
  }

  public on(event: SyncEventType, callback: SyncEventCallback): () => void {
    return this.eventBus.on(event, callback);
  }

  private emit(event: SyncEventType, data: unknown) {
    this.eventBus.emit(event, data);
  }

  private setStatus(status: SyncStatus, error?: string) {
    applySyncStatus({
      status,
      error,
      lastError: this._lastError,
      setLastError: (value) => {
        this._lastError = value;
      },
      setStatus: (value) => {
        this._status = value;
      },
      emit: (event, data) => this.emit(event, data),
    });
  }

  private setSyncLock(value: boolean) {
    this.syncLock = value;
  }

  private resetRuntimeState() {
    this._lastSyncTime = null;
    this._lastError = null;
  }

  private async withRetry<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
    return runWithSyncRetry({
      operation,
      operationName,
      maxRetries: this.maxRetries,
      baseRetryDelay: this.baseRetryDelay,
    });
  }

  public register() {
    this.startupReady = registerSyncEngine({
      db: this.db,
      tables: this.tables,
      isRegistered: () => this._registered,
      setRegistered: (value) => {
        this._registered = value;
      },
      processDeferredOperations: () => this.processDeferredOperations(),
      recordOperation: (table, type, key, payload) =>
        this.recordOperation(table, type, key, payload),
    });
  }

  public async recordOperation(table: string, type: OperationType, key: unknown, payload: unknown) {
    await recordSyncOperation({
      db: this.db,
      ensureClientId: () => this.ensureClientId(),
      table,
      type,
      key,
      payload,
    });
  }

  public async push() {
    await this.startupReady;
    await runSyncCommand({
      syncLock: this.syncLock,
      action: 'push',
      status: 'pushing',
      setSyncLock: (value) => {
        this.syncLock = value;
      },
      setStatus: (status, error) => this.setStatus(status, error),
      execute: () =>
        runPushFlow({
          db: this.db,
          provider: this.provider,
          ensureClientId: () => this.ensureClientId(),
          withRetry: (operation, operationName) => this.withRetry(operation, operationName),
          pushBatchSize: this.PUSH_BATCH_SIZE,
        }),
      shouldEmitComplete: (pushedCount) => pushedCount > 0,
      getCompleteCount: (pushedCount) => pushedCount,
      setLastSyncTime: (value) => {
        this._lastSyncTime = value;
      },
      emit: (event, data) => this.emit(event, data),
    });
  }

  public async pull() {
    await this.startupReady;
    await runSyncCommand({
      syncLock: this.syncLock,
      action: 'pull',
      status: 'pulling',
      setSyncLock: (value) => {
        this.syncLock = value;
      },
      setStatus: (status, error) => this.setStatus(status, error),
      execute: () =>
        runPullFlow({
          db: this.db,
          tables: this.tables,
          provider: this.provider,
          ensureClientId: () => this.ensureClientId(),
          withRetry: (operation, operationName) => this.withRetry(operation, operationName),
          maxPullLoops: this.MAX_PULL_LOOPS,
          applyOperation: (operation) => this.applyOperation(operation),
        }),
      shouldEmitComplete: ({ totalPulled, loopCount }) => totalPulled > 0 || loopCount > 0,
      getCompleteCount: ({ totalPulled }) => totalPulled,
      setLastSyncTime: (value) => {
        this._lastSyncTime = value;
      },
      emit: (event, data) => this.emit(event, data),
    });
  }

  private async applyOperation(op: SyncOperation) {
    await applySyncOperation(
      {
        db: this.db,
        tables: this.tables,
      },
      op
    );
  }

  public destroy() {
    this.eventBus.clear();
  }

  public async getPendingCounts(): Promise<SyncPendingCounts> {
    return getSyncPendingCounts({
      db: this.db,
      provider: this.provider,
      syncLock: this.syncLock,
      ensureClientId: () => this.ensureClientId(),
    });
  }

  public async resetSyncState() {
    await resetSyncState({
      db: this.db,
      syncLock: this.syncLock,
      setSyncLock: (value) => this.setSyncLock(value),
      setStatus: (status) => this.setStatus(status),
      resetRuntimeState: () => this.resetRuntimeState(),
    });
  }

  public async clearAllData(options?: { preservePersonal?: boolean }) {
    const preservePersonal = options?.preservePersonal ?? true;

    await clearAllSyncData({
      db: this.db,
      tables: this.tables,
      syncLock: this.syncLock,
      setSyncLock: (value) => this.setSyncLock(value),
      setStatus: (status) => this.setStatus(status),
      resetRuntimeState: () => this.resetRuntimeState(),
      preservePersonal,
    });

    this.clientId = null;

    // 保留了个人表但 operations 已空：若有个人私钥则补回同步队列
    if (!preservePersonal) {
      return;
    }

    try {
      const personalKey = await loadPersonalKey();
      if (personalKey) {
        const enqueued = await this.enqueuePersonalData();
        if (enqueued > 0) {
          logger.info(`[Sync] Re-enqueued ${enqueued} personal ops after clearAllData`);
        }
      }
    } catch (error) {
      logger.warn('[Sync] Failed to re-enqueue personal data after clearAllData', error);
    }
  }

  public async regenerateOperations() {
    await regenerateSyncOperations({
      db: this.db,
      tables: this.tables,
      syncLock: this.syncLock,
      setSyncLock: (value) => this.setSyncLock(value),
      ensureClientId: () => this.ensureClientId(),
    });
  }

  /** 个人私钥就绪后，将本地个人表数据补入同步队列 */
  public async enqueuePersonalData() {
    return enqueuePersonalSyncData({
      db: this.db,
      ensureClientId: () => this.ensureClientId(),
    });
  }

  public async processDeferredOperations() {
    await processSyncOperationRecovery(this.db, () => this.ensureClientId());
    await migrateDeferredChunks(this.db);
    await processDeferredOperations({
      db: this.db,
      tables: this.tables,
      applyOperation: (operation) => this.applyOperation(operation),
    });
  }

  public async recoverLocalData(): Promise<number> {
    await this.startupReady;
    if (this.syncLock) {
      logger.debug('[Sync] Skipping local recovery while another sync is running');
      return 0;
    }

    this.syncLock = true;
    try {
      return await recoverLocalSyncData({
        db: this.db,
        tables: this.tables,
        ensureClientId: () => this.ensureClientId(),
        applyOperation: (operation) => this.applyOperation(operation),
      });
    } finally {
      this.syncLock = false;
    }
  }

  public async recoverAfterUpgrade(): Promise<void> {
    await this.recoverLocalData();

    const state = (await this.db.table('syncMetadata').get('global')) as SyncMetadata | undefined;
    const hasAdvancedCursor = Number(state?.lastServerCursor ?? 0) > 0;
    const recoveryCompleted =
      state?.syncProtocolVersion === 2 && state.chunkRecoveryCompleted === true;
    if (!hasAdvancedCursor || recoveryCompleted) return;

    await this.pull();
  }
}
