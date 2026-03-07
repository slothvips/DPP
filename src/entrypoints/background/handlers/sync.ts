// Sync message handlers for background script
import { browser } from 'wxt/browser';
import { syncEngine } from '@/db';
import { getSetting, updateSetting } from '@/lib/db/settings';
import { performGlobalSync } from '@/lib/globalSync';
import { logger } from '@/utils/logger';

export type SyncMessage =
  | { type: 'AUTO_SYNC_TRIGGER_PUSH' }
  | { type: 'AUTO_SYNC_TRIGGER_PULL' }
  | { type: 'GLOBAL_SYNC_START' }
  | { type: 'GLOBAL_SYNC_PUSH' }
  | { type: 'GLOBAL_SYNC_PULL' };

// Throttle timestamps
let lastPushTriggerTime = 0;
let lastPullTriggerTime = 0;

/**
 * Setup auto sync alarm
 */
export async function setupAutoSync() {
  try {
    const enabledSetting = await getSetting('auto_sync_enabled');
    const intervalSetting = await getSetting('auto_sync_interval');

    const enabled = enabledSetting !== undefined ? Boolean(enabledSetting) : true;
    const interval = typeof intervalSetting === 'number' ? intervalSetting : 30;

    if (enabled) {
      logger.info(`Setting up auto sync alarm for every ${interval} minutes`);
      if (browser.alarms) {
        await browser.alarms.create('auto-sync-alarm', { periodInMinutes: interval });
      }
    } else {
      logger.info('Auto sync is disabled, clearing alarm');
      if (browser.alarms) {
        await browser.alarms.clear('auto-sync-alarm');
      }
    }
  } catch (e) {
    logger.error('Failed to setup auto sync:', e);
  }
}

/**
 * Handle Sync messages
 */
export async function handleSyncMessage(
  message: SyncMessage
): Promise<{ success: boolean; error?: string }> {
  switch (message.type) {
    case 'AUTO_SYNC_TRIGGER_PUSH': {
      const now = Date.now();
      if (now - lastPushTriggerTime < 3000) return { success: true };
      lastPushTriggerTime = now;

      const enabledSetting = await getSetting('auto_sync_enabled');
      if (enabledSetting !== undefined ? Boolean(enabledSetting) : true) {
        logger.info('Auto sync (push) triggered by data change');
        try {
          const status = await getSetting('global_sync_status');
          if (status === 'syncing') {
            logger.info('Skipping auto sync push: global sync is already in progress');
            return { success: true };
          }
          await updateSetting('global_sync_status', 'syncing');
          await syncEngine.push();
          await updateSetting('global_sync_status', 'idle');
          await updateSetting('global_sync_error', '');
        } catch (err) {
          logger.error('Auto sync push failed:', err);
          await updateSetting('global_sync_status', 'error');
          await updateSetting(
            'global_sync_error',
            err instanceof Error ? err.message : String(err)
          );
        }
      }
      return { success: true };
    }

    case 'AUTO_SYNC_TRIGGER_PULL': {
      const now = Date.now();
      if (now - lastPullTriggerTime < 500) {
        logger.debug('Throttled pull trigger');
        return { success: true };
      }
      lastPullTriggerTime = now;

      const enabledSetting = await getSetting('auto_sync_enabled');
      if (enabledSetting !== undefined ? Boolean(enabledSetting) : true) {
        logger.info('Auto sync (pull/global) triggered by UI open');
        try {
          const status = await getSetting('global_sync_status');
          if (status === 'syncing') {
            logger.info('Skipping auto sync on open: already syncing');
            return { success: true };
          }
          await performGlobalSync();
        } catch (err) {
          logger.error('Auto sync pull failed:', err);
        }
      }
      return { success: true };
    }

    case 'GLOBAL_SYNC_START':
      try {
        await performGlobalSync();
        return { success: true };
      } catch (err) {
        logger.error('Global sync failed:', err);
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }

    case 'GLOBAL_SYNC_PUSH':
      try {
        await updateSetting('global_sync_status', 'syncing');
        await syncEngine.push();
        await updateSetting('global_sync_status', 'idle');
        await updateSetting('global_sync_error', '');
        return { success: true };
      } catch (err) {
        logger.error('Global sync push failed:', err);
        await updateSetting('global_sync_status', 'error');
        await updateSetting('global_sync_error', err instanceof Error ? err.message : String(err));
        return { success: false, error: String(err) };
      }

    case 'GLOBAL_SYNC_PULL':
      try {
        await updateSetting('global_sync_status', 'syncing');
        await syncEngine.pull();
        await updateSetting('global_sync_status', 'idle');
        await updateSetting('global_sync_error', '');
        return { success: true };
      } catch (err) {
        logger.error('Global sync pull failed:', err);
        await updateSetting('global_sync_status', 'error');
        await updateSetting('global_sync_error', err instanceof Error ? err.message : String(err));
        return { success: false, error: String(err) };
      }

    default:
      return { success: false, error: 'Unknown sync message type' };
  }
}
