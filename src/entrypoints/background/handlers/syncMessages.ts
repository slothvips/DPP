import { syncEngine } from '@/db';
import { performGlobalSync } from '@/lib/globalSync';
import { logger } from '@/utils/logger';
import {
  isAutoSyncEnabled,
  isGlobalSyncRunning,
  shouldThrottlePullTrigger,
  shouldThrottlePushTrigger,
  withGlobalSyncStatus,
} from './syncShared';

export type SyncMessage =
  | { type: 'AUTO_SYNC_TRIGGER_PUSH' }
  | { type: 'AUTO_SYNC_TRIGGER_PULL' }
  | { type: 'GLOBAL_SYNC_START' }
  | { type: 'GLOBAL_SYNC_PUSH' }
  | { type: 'GLOBAL_SYNC_PULL' };

export async function handleAutoSyncPush() {
  if (shouldThrottlePushTrigger(Date.now())) {
    return { success: true };
  }

  if (!(await isAutoSyncEnabled())) {
    return { success: true };
  }

  logger.info('Auto sync (push) triggered by data change');
  try {
    if (await isGlobalSyncRunning()) {
      logger.info('Skipping auto sync push: global sync is already in progress');
      return { success: true };
    }

    await withGlobalSyncStatus(() => syncEngine.push());
  } catch (error) {
    logger.error('Auto sync push failed:', error);
  }

  return { success: true };
}

export async function handleAutoSyncPull() {
  if (shouldThrottlePullTrigger(Date.now())) {
    return { success: true };
  }

  if (!(await isAutoSyncEnabled())) {
    return { success: true };
  }

  logger.info('Auto sync (pull/global) triggered by UI open');
  try {
    if (await isGlobalSyncRunning()) {
      logger.info('Skipping auto sync on open: already syncing');
      return { success: true };
    }

    await performGlobalSync();
  } catch (error) {
    logger.error('Auto sync pull failed:', error);
  }

  return { success: true };
}

export async function handleGlobalSyncStart() {
  try {
    await performGlobalSync();
    return { success: true };
  } catch (error) {
    logger.error('Global sync failed:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function handleGlobalSyncPush() {
  try {
    await withGlobalSyncStatus(() => syncEngine.push());
    return { success: true };
  } catch (error) {
    logger.error('Global sync push failed:', error);
    return { success: false, error: String(error) };
  }
}

export async function handleGlobalSyncPull() {
  try {
    await withGlobalSyncStatus(() => syncEngine.pull());
    return { success: true };
  } catch (error) {
    logger.error('Global sync pull failed:', error);
    return { success: false, error: String(error) };
  }
}
