import { browser } from 'wxt/browser';
import { getSetting, updateSetting } from '@/lib/db/settings';
import type { GlobalSyncPhase } from '@/lib/sync/types';
import { logger } from '@/utils/logger';

let lastPushTriggerTime = 0;
let lastPullTriggerTime = 0;
let globalStatusLockRunning = false;
let pushRetryAttempt = 0;
let pushRetryTimer: ReturnType<typeof setTimeout> | null = null;
let pushRetrySchedule: Promise<void> | null = null;
let deferredPullPending = false;
let deferredPushTimer: ReturnType<typeof setTimeout> | null = null;
let deferredPushPending = false;

const PUSH_RETRY_BASE_DELAY = 30_000;
const PUSH_RETRY_MAX_DELAY = 30 * 60_000;
const DEFERRED_PUSH_DELAY = 1500;
const AUTO_PULL_COOLDOWN = 30_000;
export const PUSH_RETRY_ALARM = 'auto-sync-push-retry-alarm';
const PUSH_RETRY_ATTEMPT_SETTING = 'sync_push_retry_attempt';

export async function isAutoSyncEnabled(): Promise<boolean> {
  const enabledSetting = await getSetting('auto_sync_enabled');
  return enabledSetting !== undefined ? Boolean(enabledSetting) : true;
}

export function shouldThrottlePushTrigger(now: number): boolean {
  if (now - lastPushTriggerTime < 3000) {
    return true;
  }

  lastPushTriggerTime = now;
  return false;
}

export function scheduleDeferredPushTrigger(): void {
  if (deferredPushTimer !== null || deferredPushPending) return;

  deferredPushTimer = setTimeout(() => {
    deferredPushTimer = null;
    lastPushTriggerTime = Date.now();
    void browser.runtime
      .sendMessage({ type: 'AUTO_SYNC_TRIGGER_PUSH', deferred: true })
      .catch((error) => logger.warn('[Sync] Failed to trigger deferred push:', error));
  }, DEFERRED_PUSH_DELAY);
}

export function deferAutoSyncPush(): void {
  deferredPushPending = true;
}

export async function flushDeferredAutoSyncPush(): Promise<void> {
  if (deferredPushTimer !== null || !deferredPushPending) return;
  deferredPushPending = false;
  try {
    await browser.runtime.sendMessage({ type: 'AUTO_SYNC_TRIGGER_PUSH', deferred: true });
  } catch (error) {
    logger.warn('[Sync] Failed to flush deferred push:', error);
  }
}

export function cancelDeferredPushTrigger(): void {
  if (deferredPushTimer !== null) {
    clearTimeout(deferredPushTimer);
    deferredPushTimer = null;
  }
  deferredPushPending = false;
}

export async function isPushRetryPending(): Promise<boolean> {
  if (pushRetryTimer !== null) return true;
  if (!browser.alarms) return false;
  return (await browser.alarms.get(PUSH_RETRY_ALARM)) !== undefined;
}

export function schedulePushRetry(): Promise<void> {
  if (pushRetrySchedule) return pushRetrySchedule;
  pushRetrySchedule = schedulePushRetryUnlocked().finally(() => {
    pushRetrySchedule = null;
  });
  return pushRetrySchedule;
}

async function schedulePushRetryUnlocked(): Promise<void> {
  if (!(await isAutoSyncEnabled())) {
    await resetPushRetry();
    return;
  }

  if (await isPushRetryPending()) return;

  const storedAttempt = await getSetting<number>(PUSH_RETRY_ATTEMPT_SETTING);
  const attempt =
    typeof storedAttempt === 'number' && Number.isInteger(storedAttempt) && storedAttempt >= 0
      ? storedAttempt
      : pushRetryAttempt;
  const delay = Math.min(PUSH_RETRY_MAX_DELAY, PUSH_RETRY_BASE_DELAY * 2 ** Math.min(attempt, 6));
  pushRetryAttempt = attempt + 1;
  try {
    await updateSetting(PUSH_RETRY_ATTEMPT_SETTING, pushRetryAttempt);
    logger.warn(`[Sync] Push failed; retry scheduled in ${delay}ms`);

    if (browser.alarms) {
      try {
        await browser.alarms.create(PUSH_RETRY_ALARM, { when: Date.now() + delay });
      } catch (error) {
        await updateSetting(PUSH_RETRY_ATTEMPT_SETTING, attempt).catch((rollbackError) =>
          logger.warn('[Sync] Failed to roll back push retry state:', rollbackError)
        );
        pushRetryAttempt = attempt;
        throw error;
      }
      return;
    }

    pushRetryTimer = setTimeout(() => {
      pushRetryTimer = null;
      void browser.runtime
        .sendMessage({ type: 'AUTO_SYNC_TRIGGER_PUSH', retry: true })
        .catch((error) => logger.warn('[Sync] Failed to trigger push retry:', error));
    }, delay);
  } catch (error) {
    pushRetryAttempt = attempt;
    throw error;
  }
}

export async function resetPushRetry(): Promise<void> {
  if (pushRetryTimer !== null) {
    clearTimeout(pushRetryTimer);
    pushRetryTimer = null;
  }
  try {
    await browser.alarms?.clear(PUSH_RETRY_ALARM);
    await updateSetting(PUSH_RETRY_ATTEMPT_SETTING, 0);
  } catch (error) {
    logger.warn('[Sync] Failed to reset push retry state:', error);
  }
  pushRetryAttempt = 0;
}

export function shouldThrottlePullTrigger(now: number): boolean {
  if (now - lastPullTriggerTime < AUTO_PULL_COOLDOWN) {
    logger.debug('Throttled pull trigger');
    return true;
  }

  lastPullTriggerTime = now;
  return false;
}

export function deferAutoSyncPull(): void {
  deferredPullPending = true;
}

export async function flushDeferredAutoSyncPull(): Promise<void> {
  if (!deferredPullPending) return;
  deferredPullPending = false;
  try {
    await browser.runtime.sendMessage({ type: 'AUTO_SYNC_TRIGGER_PULL', deferred: true });
  } catch (error) {
    logger.warn('[Sync] Failed to flush deferred pull:', error);
  }
}

export async function setupAutoSync() {
  try {
    const enabled = await isAutoSyncEnabled();
    const intervalSetting = await getSetting('auto_sync_interval');
    const interval = typeof intervalSetting === 'number' ? intervalSetting : 30;

    if (enabled) {
      logger.info(`Setting up auto sync alarm for every ${interval} minutes`);
      if (browser.alarms) {
        await browser.alarms.create('auto-sync-alarm', { periodInMinutes: interval });
      }
      return;
    }

    logger.info('Auto sync is disabled, clearing alarm');
    if (browser.alarms) {
      await browser.alarms.clear('auto-sync-alarm');
    }
    cancelDeferredPushTrigger();
    await resetPushRetry();
  } catch (error) {
    logger.error('Failed to setup auto sync:', error);
  }
}

export async function withGlobalSyncStatus<T>(
  operation: () => Promise<T>,
  phase: GlobalSyncPhase = 'database'
): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return await navigator.locks.request('dpp-global-sync', { ifAvailable: true }, async (lock) => {
      if (!lock) throw new Error('Global sync is already in progress');
      return await runGlobalSyncStatus(operation, phase);
    });
  }
  if (globalStatusLockRunning) {
    throw new Error('Global sync is already in progress');
  }
  globalStatusLockRunning = true;
  try {
    return await runGlobalSyncStatus(operation, phase);
  } finally {
    globalStatusLockRunning = false;
  }
}

async function runGlobalSyncStatus<T>(
  operation: () => Promise<T>,
  phase: GlobalSyncPhase
): Promise<T> {
  try {
    await updateSetting('global_sync_status', 'syncing');
    await updateSetting('global_sync_phase', phase);
    const result = await operation();
    await updateSetting('global_sync_status', 'idle');
    await updateSetting('global_sync_phase', 'idle');
    await updateSetting('global_sync_error', '');
    return result;
  } catch (error) {
    await updateSetting('global_sync_status', 'error');
    await updateSetting('global_sync_phase', 'idle');
    await updateSetting(
      'global_sync_error',
      error instanceof Error ? error.message : String(error)
    );
    throw error;
  }
}

export async function isGlobalSyncRunning(): Promise<boolean> {
  const status = await getSetting('global_sync_status');
  return status === 'syncing';
}
