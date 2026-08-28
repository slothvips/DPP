import { browser } from 'wxt/browser';
import { syncEngine } from '@/db';
import { getSetting, updateSetting } from '@/lib/db/settings';
import { performGlobalSync } from '@/lib/globalSync';
import { logger } from '@/utils/logger';
import {
  flushDeferredAutoSyncPull,
  flushDeferredAutoSyncPush,
  handleSyncMessage,
  recoverInterruptedBrowserTask,
  setupAutoSync,
  setupOmnibox,
} from './handlers';
import { PUSH_RETRY_ALARM } from './handlers/syncShared';

export function registerBackgroundLifecycle() {
  browser.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => logger.error('Failed to set side panel behavior:', error));

  void setupAutoSync();
  void syncEngine
    .recoverAfterUpgrade()
    .then(async () => {
      logger.info('[Sync] Upgrade recovery completed');
      await handleSyncMessage({ type: 'AUTO_SYNC_TRIGGER_PUSH' });
    })
    .catch((error) => logger.warn('[Sync] Background local recovery failed:', error));
  void recoverInterruptedBrowserTask().catch((error) =>
    logger.error('Failed to recover interrupted browser task:', error)
  );

  if (browser.alarms) {
    browser.alarms.onAlarm.addListener(async (alarm) => {
      try {
        if (alarm.name === PUSH_RETRY_ALARM) {
          await handleSyncMessage({ type: 'AUTO_SYNC_TRIGGER_PUSH', retry: true });
          return;
        }
        if (alarm.name !== 'auto-sync-alarm') {
          return;
        }

        const enabledSetting = await getSetting('auto_sync_enabled');
        if (enabledSetting === false) {
          logger.info('Auto sync alarm triggered but auto sync is disabled, skipping');
          return;
        }

        logger.info('Auto sync alarm triggered');
        await performGlobalSync();
        await flushDeferredAutoSyncPush();
        await flushDeferredAutoSyncPull();
      } catch (error) {
        logger.error('Auto sync failed:', error);
      }
    });
  }

  browser.runtime.onMessage.addListener((message) => {
    if (message.type === 'AUTO_SYNC_SETTINGS_CHANGED') {
      setupAutoSync().catch((error) => logger.error('Failed to setup auto sync:', error));
    }
    return false;
  });

  getSetting('global_sync_status')
    .then(async (status) => {
      if (status === 'syncing') {
        logger.warn('Detected stuck sync status on startup. Resetting to idle.');
        await updateSetting('global_sync_status', 'idle');
        await updateSetting('global_sync_phase', 'idle');
        await updateSetting('global_sync_error', '');
      }
    })
    .catch((error) => {
      logger.error('Failed to check sync status on startup:', error);
    });

  if (typeof globalThis !== 'undefined') {
    globalThis.addEventListener('online', () => {
      logger.info('Network online, triggering database auto sync');
      getSetting('auto_sync_enabled')
        .then((enabledSetting) => {
          if (enabledSetting !== undefined ? Boolean(enabledSetting) : true) {
            handleSyncMessage({ type: 'AUTO_SYNC_TRIGGER_PULL' }).catch((error) =>
              logger.error('Online auto sync failed:', error)
            );
          }
        })
        .catch((error) => {
          logger.error('Failed to get auto sync setting:', error);
        });
    });
  }

  setupOmnibox();
}
