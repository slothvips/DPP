import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { db, syncEngine } from '@/db';
import { getSetting, updateSetting } from '@/lib/db/settings';
import type { SyncPendingCounts } from '@/lib/sync/types';
import { logger } from '@/utils/logger';

interface SyncMessageResponse {
  success: boolean;
  error?: string;
}

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
  const { toast } = useToast();

  const sendSyncMessage = useCallback(
    async (type: 'GLOBAL_SYNC_START' | 'GLOBAL_SYNC_PUSH' | 'GLOBAL_SYNC_PULL') => {
      const response = (await browser.runtime.sendMessage({ type })) as SyncMessageResponse;
      if (!response?.success) {
        throw new Error(response?.error || '同步请求失败');
      }
    },
    []
  );

  const isSyncing =
    useLiveQuery(async () => {
      const status = await getSetting('global_sync_status');
      return status === 'syncing';
    }) ?? false;

  const error =
    useLiveQuery(async () => {
      const err = await getSetting('global_sync_error');
      return err || null;
    }) ?? null;

  const lastSyncTime =
    useLiveQuery(async () => {
      const setting = await getSetting('last_global_sync');
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
      const startTime = (await getSetting('global_sync_start_time')) || 0;
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
      await sendSyncMessage('GLOBAL_SYNC_PUSH');
      await sendSyncMessage('GLOBAL_SYNC_PULL');
      await sendSyncMessage('GLOBAL_SYNC_START');
      await refreshCounts();
    } catch (e) {
      logger.error('[useGlobalSync] Sync failed:', e);
      toast(e instanceof Error ? `同步失败：${e.message}` : '同步失败，请重试', 'error');
    }
  }, [isSyncing, refreshCounts, sendSyncMessage, toast]);

  const push = useCallback(async () => {
    try {
      await sendSyncMessage('GLOBAL_SYNC_PUSH');
      await refreshCounts();
    } catch (e) {
      logger.error('[useGlobalSync] Push failed:', e);
      toast(e instanceof Error ? `推送失败：${e.message}` : '推送失败，请重试', 'error');
    }
  }, [refreshCounts, sendSyncMessage, toast]);

  const pull = useCallback(async () => {
    try {
      await sendSyncMessage('GLOBAL_SYNC_PULL');
      await refreshCounts();
    } catch (e) {
      logger.error('[useGlobalSync] Pull failed:', e);
      toast(e instanceof Error ? `拉取失败：${e.message}` : '拉取失败，请重试', 'error');
    }
  }, [refreshCounts, sendSyncMessage, toast]);

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
