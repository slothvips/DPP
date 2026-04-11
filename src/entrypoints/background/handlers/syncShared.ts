import { browser } from 'wxt/browser';
import { getSetting, updateSetting } from '@/lib/db/settings';
import { logger } from '@/utils/logger';

let lastPushTriggerTime = 0;
let lastPullTriggerTime = 0;

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

export function shouldThrottlePullTrigger(now: number): boolean {
  if (now - lastPullTriggerTime < 500) {
    logger.debug('Throttled pull trigger');
    return true;
  }

  lastPullTriggerTime = now;
  return false;
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
  } catch (error) {
    logger.error('Failed to setup auto sync:', error);
  }
}

export async function withGlobalSyncStatus<T>(operation: () => Promise<T>): Promise<T> {
  try {
    await updateSetting('global_sync_status', 'syncing');
    const result = await operation();
    await updateSetting('global_sync_status', 'idle');
    await updateSetting('global_sync_error', '');
    return result;
  } catch (error) {
    await updateSetting('global_sync_status', 'error');
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
