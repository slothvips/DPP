import { SyncEngine } from '@/lib/sync/SyncEngine';
import type { SyncPendingCounts } from '@/lib/sync/types';
import { createDefaultSyncProvider } from './syncProvider';
import type { DPPDatabase } from './types';

let syncEngineInstance: SyncEngine | null = null;

export async function getSyncEngine(db: DPPDatabase): Promise<SyncEngine | null> {
  if (!syncEngineInstance) {
    syncEngineInstance = new SyncEngine(
      db,
      ['tags', 'jobTags', 'links', 'linkTags', 'blackboard'],
      createDefaultSyncProvider(db)
    );
    syncEngineInstance.register();
  }
  return syncEngineInstance;
}

export function createSyncEngineFacade(db: DPPDatabase) {
  return {
    get instance(): SyncEngine | null {
      return syncEngineInstance;
    },
    async push() {
      return (await getSyncEngine(db))?.push();
    },
    async pull() {
      return (await getSyncEngine(db))?.pull();
    },
    async destroy() {
      syncEngineInstance?.destroy();
    },
    async on(
      event: 'status-change' | 'sync-error' | 'sync-complete',
      callback: (data: unknown) => void
    ) {
      return (await getSyncEngine(db))?.on(event, callback);
    },
    get status() {
      return syncEngineInstance?.status ?? 'idle';
    },
    get lastError() {
      return syncEngineInstance?.lastError ?? null;
    },
    get lastSyncTime() {
      return syncEngineInstance?.lastSyncTime ?? null;
    },
    async getClientId() {
      return (await getSyncEngine(db))?.getClientId() ?? null;
    },
    async getPendingCounts(): Promise<SyncPendingCounts> {
      return (await getSyncEngine(db))?.getPendingCounts() ?? { push: 0, pull: 0 };
    },
  };
}
