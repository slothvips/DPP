import type Dexie from 'dexie';
import { logger } from '@/utils/logger';
import { generateUUID, sleep } from './SyncEngine.shared';
import type { SyncStatus } from './types';

export { withSyncEngineLock } from './SyncEngine.lock';

export type SyncEventType = 'status-change' | 'sync-error' | 'sync-complete';
export type SyncEventCallback = (data: unknown) => void;

let clientIdInitialization: Promise<string> | null = null;

export async function ensureSyncClientId(options: {
  db: Dexie;
  currentClientId: string | null;
  setClientId: (value: string) => void;
}): Promise<string> {
  const { db, currentClientId, setClientId } = options;

  if (!clientIdInitialization) {
    clientIdInitialization = (async () => {
      const setting = await db.table('settings').get('sync_client_id');
      if (typeof setting?.value === 'string' && setting.value.length > 0) {
        return setting.value;
      }

      const candidate = currentClientId ?? generateUUID();
      try {
        await db.table('settings').add({ key: 'sync_client_id', value: candidate });
        return candidate;
      } catch (error) {
        const winner = await db.table('settings').get('sync_client_id');
        if (typeof winner?.value === 'string' && winner.value.length > 0) {
          return winner.value;
        }
        throw error;
      }
    })();
  }

  try {
    const clientId = await clientIdInitialization;
    setClientId(clientId);
    return clientId;
  } finally {
    clientIdInitialization = null;
  }
}

export class SyncEventBus {
  private listeners = new Map<SyncEventType, Set<SyncEventCallback>>();

  on(event: SyncEventType, callback: SyncEventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(callback);

    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  emit(event: SyncEventType, data: unknown) {
    const callbacks = this.listeners.get(event);
    if (!callbacks) {
      return;
    }

    for (const callback of callbacks) {
      callback(data);
    }
  }

  clear() {
    this.listeners.clear();
  }
}

export function applySyncStatus(options: {
  status: SyncStatus;
  error?: string;
  lastError: string | null;
  setLastError: (value: string | null) => void;
  setStatus: (value: SyncStatus) => void;
  emit: (event: SyncEventType, data: unknown) => void;
}) {
  const { status, error, setLastError, setStatus, emit } = options;

  setStatus(status);
  if (error) {
    setLastError(error);
  } else if (status === 'idle') {
    setLastError(null);
  }

  emit('status-change', { status, error });
}

export async function runWithSyncRetry<T>(options: {
  operation: () => Promise<T>;
  operationName: string;
  maxRetries: number;
  baseRetryDelay: number;
}): Promise<T> {
  const { operation, operationName, maxRetries, baseRetryDelay } = options;
  const attempts = Number.isFinite(maxRetries) ? Math.max(1, Math.floor(maxRetries)) : 1;
  const retryDelay = Number.isFinite(baseRetryDelay) ? Math.max(0, baseRetryDelay) : 0;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (!isRetryableSyncError(lastError)) {
        throw lastError;
      }
      if (attempt >= attempts - 1) {
        break;
      }

      const delay = retryDelay * 2 ** attempt;

      logger.warn(
        `[Sync] ${operationName} failed (attempt ${attempt + 1}/${attempts}), retrying in ${delay}ms:`,
        lastError.message
      );

      if (attempt < attempts - 1) {
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

export function isRetryableSyncError(error: Error): boolean {
  return !/(401|403|404|409|unauthorized|not configured|invalid|no encryption key|did not confirm|exceeds the sync payload limit)/i.test(
    error.message
  );
}
