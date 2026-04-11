import type Dexie from 'dexie';
import { logger } from '@/utils/logger';
import type { SyncMetadata, SyncPendingCounts, SyncProvider } from './types';

interface GetPendingCountsOptions {
  db: Dexie;
  provider: SyncProvider;
  syncLock: boolean;
  ensureClientId: () => Promise<string>;
}

export async function getSyncPendingCounts({
  db,
  provider,
  syncLock,
  ensureClientId,
}: GetPendingCountsOptions): Promise<SyncPendingCounts> {
  if (syncLock) {
    return { push: 0, pull: 0 };
  }

  const pushCount = await db.table('operations').where('synced').equals(0).count();

  let pullCount = 0;
  if (provider.getPendingCount) {
    try {
      const clientId = await ensureClientId();
      const state = (await db.table('syncMetadata').get('global')) as SyncMetadata | undefined;
      const cursor = state?.lastServerCursor;
      pullCount = await provider.getPendingCount(cursor, clientId);
    } catch (error) {
      logger.warn('[Sync] Failed to get remote pending count:', error);
    }
  }

  return { push: pushCount, pull: pullCount };
}
