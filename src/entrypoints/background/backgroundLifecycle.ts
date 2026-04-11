import { browser } from 'wxt/browser';
import { getSetting, updateSetting } from '@/lib/db/settings';
import { performGlobalSync } from '@/lib/globalSync';
import { clearAllAgents, registerInjectorTabLifecycle } from '@/lib/pageAgent/injector';
import { logger } from '@/utils/logger';
import { setupAutoSync, setupOmnibox } from './handlers';

export function registerBackgroundLifecycle() {
  // 注册 PageAgent 标签页生命周期监听（仅在 background 上下文）
  registerInjectorTabLifecycle();

  browser.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => logger.error('Failed to set side panel behavior:', error));

  browser.sidePanel.onClosed.addListener(() => {
    logger.info('[Background] Side panel closed, destroying all PageAgent instances');
    clearAllAgents().catch((error: Error) =>
      logger.error('Failed to clear agents on side panel close:', error)
    );
  });

  void setupAutoSync();

  if (browser.alarms) {
    browser.alarms.onAlarm.addListener(async (alarm) => {
      if (alarm.name !== 'auto-sync-alarm') {
        return;
      }

      const enabledSetting = await getSetting('auto_sync_enabled');
      if (enabledSetting === false) {
        logger.info('Auto sync alarm triggered but auto sync is disabled, skipping');
        return;
      }

      logger.info('Auto sync alarm triggered');
      performGlobalSync().catch((error) => logger.error('Auto sync failed:', error));
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
        await updateSetting('global_sync_error', '');
      }
    })
    .catch((error) => {
      logger.error('Failed to check sync status on startup:', error);
    });

  if (typeof globalThis !== 'undefined') {
    globalThis.addEventListener('online', () => {
      logger.info('Network online, triggering global auto sync');
      getSetting('auto_sync_enabled')
        .then((enabledSetting) => {
          if (enabledSetting !== undefined ? Boolean(enabledSetting) : true) {
            performGlobalSync().catch((error) => logger.error('Online auto sync failed:', error));
          }
        })
        .catch((error) => {
          logger.error('Failed to get auto sync setting:', error);
        });
    });
  }

  setupOmnibox();
}
