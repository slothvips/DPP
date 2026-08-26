import type Dexie from 'dexie';
import { browser } from 'wxt/browser';
import { logger } from '@/utils/logger';
import { registerSyncHooks } from './SyncEngine.hooks';
import { saveSyncOperationForRecovery } from './SyncEngine.recovery';
import { generateUUID } from './SyncEngine.shared';
import type { OperationType, SyncOperation, SyncStatus } from './types';

interface RegisterSyncEngineOptions {
  db: Dexie;
  tables: string[];
  isRegistered: () => boolean;
  setRegistered: (value: boolean) => void;
  processDeferredOperations: () => Promise<void>;
  recordOperation: (
    table: string,
    type: OperationType,
    key: unknown,
    payload: unknown
  ) => Promise<void>;
}

export function registerSyncEngine({
  db,
  tables,
  isRegistered,
  setRegistered,
  processDeferredOperations,
  recordOperation,
}: RegisterSyncEngineOptions): Promise<void> {
  if (isRegistered()) {
    logger.warn('[Sync] Hooks already registered, skipping duplicate registration');
    return Promise.resolve();
  }

  setRegistered(true);
  const startup = processDeferredOperations();
  startup.catch((error) => {
    logger.error('[Sync] Failed to process deferred operations on startup:', error);
  });

  registerSyncHooks({
    db,
    tables,
    isRegistered,
    recordOperation,
  });
  return startup;
}

interface RecordSyncOperationOptions {
  db: Dexie;
  ensureClientId: () => Promise<string>;
  table: string;
  type: OperationType;
  key: unknown;
  payload: unknown;
}

export async function recordSyncOperation({
  db,
  ensureClientId,
  table,
  type,
  key,
  payload,
}: RecordSyncOperationOptions) {
  const operation: SyncOperation = {
    id: generateUUID(),
    table,
    type,
    key,
    payload,
    timestamp: Date.now(),
    synced: 0,
  };

  try {
    operation.clientId = await ensureClientId();
    await db.table('operations').add(operation);
    if (typeof browser !== 'undefined' && browser.runtime) {
      browser.runtime.sendMessage({ type: 'AUTO_SYNC_TRIGGER_PUSH' }).catch(() => {});
    }
  } catch (error) {
    logger.error(`[Sync] Failed to record operation for ${table}:`, error);
    await saveSyncOperationForRecovery(db, operation);
  }
}

interface RunSyncCommandOptions<T> {
  syncLock: boolean;
  action: 'push' | 'pull';
  status: Extract<SyncStatus, 'pushing' | 'pulling'>;
  setSyncLock: (value: boolean) => void;
  setStatus: (status: SyncStatus, error?: string) => void;
  execute: () => Promise<T>;
  shouldEmitComplete: (result: T) => boolean;
  getCompleteCount: (result: T) => number;
  setLastSyncTime: (value: number) => void;
  emit: (event: 'sync-complete' | 'sync-error', data: unknown) => void;
}

export async function runSyncCommand<T>({
  syncLock,
  action,
  status,
  setSyncLock,
  setStatus,
  execute,
  shouldEmitComplete,
  getCompleteCount,
  setLastSyncTime,
  emit,
}: RunSyncCommandOptions<T>) {
  if (syncLock) {
    throw new Error(`Cannot ${action} while sync is already in progress`);
  }

  try {
    setSyncLock(true);
    setStatus(status);

    const result = await execute();

    setStatus('idle');
    if (!shouldEmitComplete(result)) {
      return;
    }

    setLastSyncTime(Date.now());
    emit('sync-complete', { type: action, count: getCompleteCount(result) });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      `[Sync] ${action === 'push' ? 'Push' : 'Pull'} failed after retries:`,
      errorMessage
    );
    setStatus('error', errorMessage);
    emit('sync-error', { type: action, error: errorMessage });
    throw error;
  } finally {
    setSyncLock(false);
  }
}
