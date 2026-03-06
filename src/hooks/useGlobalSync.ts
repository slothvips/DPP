import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useState } from 'react';
import { db, syncEngine } from '@/db';
import { getSetting, updateSetting } from '@/lib/db/settings';
import type { SyncPendingCounts } from '@/lib/sync/types';
import { logger } from '@/utils/logger';

export interface GlobalSyncState {
  isSyncing: boolean;
  lastSyncTime: number | null;
  error: string | null;
  pendingCounts: SyncPendingCounts;
  sync: () => Promise<void>;
  push: () => Promise<void>;
  pull: () => Promise<void>;
  refreshCounts: () => Promise<void>;
}

export function useGlobalSync(): GlobalSyncState {
  const [pendingCounts, setPendingCounts] = useState<SyncPendingCounts>({ push: 0, pull: 0 });

  const isSyncing =
    useLiveQuery(async () => {
      const status = await getSetting<string>('global_sync_status');
      return status === 'syncing';
    }) ?? false;

  const error =
    useLiveQuery(async () => {
      const err = await getSetting<string>('global_sync_error');
      return err || null;
    }) ?? null;

  const lastSyncTime =
    useLiveQuery(async () => {
      const setting = await getSetting<number>('last_global_sync');
      return setting || null;
    }) ?? null;

  const localPushCount =
    useLiveQuery(() => db.table('operations').where('synced').equals(0).count()) ?? 0;

  const refreshCounts = useCallback(async () => {
    try {
      const counts = await syncEngine.getPendingCounts();
      setPendingCounts(counts);
    } catch (e) {
      logger.warn('[useGlobalSync] Failed to refresh pending counts:', e);
    }
  }, []);

  // Safety check: if stuck in 'syncing' for > 5 minutes, force reset
  useEffect(() => {
    if (!isSyncing) return;

    const checkStuck = async () => {
      const startTime = (await getSetting<number>('global_sync_start_time')) || 0;
      if (startTime > 0 && Date.now() - startTime > 5 * 60 * 1000) {
        logger.warn('[useGlobalSync] Sync appears stuck (timeout). Resetting to error.');
        await updateSetting('global_sync_status', 'error');
        await updateSetting('global_sync_error', 'Sync timeout (client-side safety reset)');
      }
    };

    const timer = setInterval(checkStuck, 10000);
    checkStuck();

    return () => clearInterval(timer);
  }, [isSyncing]);

  useEffect(() => {
    setPendingCounts((prev) => ({ ...prev, push: localPushCount }));
  }, [localPushCount]);

  useEffect(() => {
    refreshCounts();
    const interval = setInterval(refreshCounts, 30000);
    return () => clearInterval(interval);
  }, [refreshCounts]);

  useEffect(() => {
    if (!isSyncing) {
      refreshCounts();
    }
  }, [isSyncing, refreshCounts]);

  const sync = useCallback(async () => {
    if (isSyncing) return;

    try {
      await browser.runtime.sendMessage({ type: 'GLOBAL_SYNC_PUSH' });
    } catch (e) {
      logger.error('[useGlobalSync] Push failed:', e);
    }

    try {
      await browser.runtime.sendMessage({ type: 'GLOBAL_SYNC_PULL' });
    } catch (e) {
      logger.error('[useGlobalSync] Pull failed:', e);
    }

    await browser.runtime.sendMessage({ type: 'GLOBAL_SYNC_START' });
    await refreshCounts();
  }, [isSyncing, refreshCounts]);

  const push = useCallback(async () => {
    try {
      await browser.runtime.sendMessage({ type: 'GLOBAL_SYNC_PUSH' });
      await refreshCounts();
    } catch (e) {
      logger.error('[useGlobalSync] Push failed:', e);
    }
  }, [refreshCounts]);

  const pull = useCallback(async () => {
    try {
      await browser.runtime.sendMessage({ type: 'GLOBAL_SYNC_PULL' });
      await refreshCounts();
    } catch (e) {
      logger.error('[useGlobalSync] Pull failed:', e);
    }
  }, [refreshCounts]);

  return {
    isSyncing,
    lastSyncTime,
    error,
    pendingCounts,
    sync,
    push,
    pull,
    refreshCounts,
  };
}
