import { syncEngine } from '@/db';
import { performGlobalSync } from '@/lib/globalSync';
import { isRetryableSyncError } from '@/lib/sync/SyncEngine.runtime';
import { syncDatabase } from '@/lib/sync/api';
import { logger } from '@/utils/logger';
import {
  deferAutoSyncPull,
  deferAutoSyncPush,
  flushDeferredAutoSyncPull,
  flushDeferredAutoSyncPush,
  isAutoSyncEnabled,
  isGlobalSyncRunning,
  isPushRetryPending,
  resetPushRetry,
  scheduleDeferredPushTrigger,
  schedulePushRetry,
  shouldThrottlePullTrigger,
  shouldThrottlePushTrigger,
  withGlobalSyncStatus,
} from './syncShared';

export type SyncMessage =
  | { type: 'AUTO_SYNC_TRIGGER_PUSH'; retry?: boolean; deferred?: boolean }
  | { type: 'AUTO_SYNC_TRIGGER_PULL'; deferred?: boolean }
  | { type: 'GLOBAL_SYNC_START' }
  | { type: 'GLOBAL_SYNC_PUSH' }
  | { type: 'GLOBAL_SYNC_PULL' };

export async function handleAutoSyncPush(retry = false, deferred = false) {
  try {
    if (!retry) {
      let retryPending = false;
      try {
        retryPending = await isPushRetryPending();
      } catch (error) {
        logger.warn('[Sync] Failed to inspect push retry state; continuing with push:', error);
      }
      if (retryPending) return { success: true };
      if (!deferred && shouldThrottlePushTrigger(Date.now())) {
        scheduleDeferredPushTrigger();
        return { success: true };
      }
    }

    if (!(await isAutoSyncEnabled())) {
      if (retry) await resetPushRetry();
      return { success: true };
    }

    logger.info('Auto sync (push) triggered by data change');
    if (await isGlobalSyncRunning()) {
      logger.info('Skipping auto sync push: global sync is already in progress');
      if (retry) {
        await schedulePushRetry();
      } else {
        deferAutoSyncPush();
      }
      return { success: true };
    }

    await withGlobalSyncStatus(() => syncEngine.push(), 'database-push');
    await resetPushRetry();
    await flushDeferredAutoSyncPush();
  } catch (error) {
    logger.error('Auto sync push failed:', error);
    const syncError = error instanceof Error ? error : new Error(String(error));
    if (isRetryableSyncError(syncError)) {
      try {
        await schedulePushRetry();
      } catch (retryError) {
        logger.error('[Sync] Failed to schedule push retry:', retryError);
      }
    } else if (retry) {
      await resetPushRetry();
    }
  }

  return { success: true };
}

export async function handleAutoSyncPull(deferred = false) {
  if (!deferred && shouldThrottlePullTrigger(Date.now())) {
    return { success: true };
  }

  if (!(await isAutoSyncEnabled())) {
    return { success: true };
  }

  logger.info('Auto sync (pull/global) triggered by UI open');
  try {
    if (await isGlobalSyncRunning()) {
      logger.info('Skipping auto sync on open: already syncing');
      deferAutoSyncPull();
      return { success: true };
    }

    await withGlobalSyncStatus(() => syncDatabase());
    await flushDeferredAutoSyncPull();
  } catch (error) {
    logger.error('Auto sync pull failed:', error);
  }

  return { success: true };
}

export async function handleGlobalSyncStart() {
  try {
    await performGlobalSync();
    await flushDeferredAutoSyncPush();
    await flushDeferredAutoSyncPull();
    return { success: true };
  } catch (error) {
    logger.error('Global sync failed:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function handleGlobalSyncPush() {
  try {
    await withGlobalSyncStatus(() => syncEngine.push(), 'database-push');
    await resetPushRetry();
    await flushDeferredAutoSyncPush();
    await flushDeferredAutoSyncPull();
    return { success: true };
  } catch (error) {
    logger.error('Global sync push failed:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function handleGlobalSyncPull() {
  try {
    await withGlobalSyncStatus(() => syncEngine.pull(), 'database-pull');
    await flushDeferredAutoSyncPush();
    await flushDeferredAutoSyncPull();
    return { success: true };
  } catch (error) {
    logger.error('Global sync pull failed:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
