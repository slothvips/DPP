// Background script - Main entry point
// This file handles message routing and delegates to handler modules
import { browser } from 'wxt/browser';
import { getSetting, updateSetting } from '@/lib/db/settings';
import { performGlobalSync } from '@/lib/globalSync';
import { serializeHeaders } from '@/lib/pageAgent/utils';
import { logger } from '@/utils/logger';
import {
  handleJenkinsMessage,
  handlePageAgentInject,
  handleProxyMessage,
  handleRecorderMessage,
  handleRemoteRecordingMessage,
  handleSyncMessage,
  setupAutoSync,
  setupOmnibox,
} from './background/handlers';

export default defineBackground(() => {
  logger.info('Background started');

  // Setup side panel behavior - Chrome handles toggle automatically
  browser.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => logger.error('Failed to set side panel behavior:', error));

  // Run initial auto sync setup
  setupAutoSync();

  // Listen for alarm
  if (browser.alarms) {
    browser.alarms.onAlarm.addListener(async (alarm) => {
      if (alarm.name === 'auto-sync-alarm') {
        // Check if auto sync is enabled before triggering
        const enabledSetting = await getSetting('auto_sync_enabled');
        if (enabledSetting === false) {
          logger.info('Auto sync alarm triggered but auto sync is disabled, skipping');
          return;
        }
        logger.info('Auto sync alarm triggered');
        performGlobalSync().catch((e) => logger.error('Auto sync failed:', e));
      }
    });
  }

  // Listen for setting changes
  browser.runtime.onMessage.addListener((message) => {
    if (message.type === 'AUTO_SYNC_SETTINGS_CHANGED') {
      setupAutoSync();
    }
    // Return false here so other listeners can also handle messages
    return false;
  });

  // Check for stuck sync status on startup
  getSetting('global_sync_status').then(async (status) => {
    if (status === 'syncing') {
      logger.warn('Detected stuck sync status on startup. Resetting to idle.');
      await updateSetting('global_sync_status', 'idle');
      await updateSetting('global_sync_error', '');
    }
  });

  // Network online event - trigger auto sync
  if (typeof self !== 'undefined') {
    self.addEventListener('online', () => {
      logger.info('Network online, triggering global auto sync');
      getSetting('auto_sync_enabled').then((enabledSetting) => {
        if (enabledSetting !== undefined ? Boolean(enabledSetting) : true) {
          performGlobalSync().catch((e) => logger.error('Online auto sync failed:', e));
        }
      });
    });
  }

  // Setup omnibox listeners
  setupOmnibox();

  // Main message router
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Jenkins messages
    if (message.type.startsWith('JENKINS_')) {
      (async () => {
        const response = await handleJenkinsMessage(message);
        sendResponse(response);
      })();
      return true;
    }

    // Recorder messages
    if (message.type.startsWith('RECORDER_')) {
      (async () => {
        const response = await handleRecorderMessage(message, sender);
        sendResponse(response);
      })();
      return true;
    }

    // Sync messages
    if (
      message.type === 'AUTO_SYNC_TRIGGER_PUSH' ||
      message.type === 'AUTO_SYNC_TRIGGER_PULL' ||
      message.type === 'GLOBAL_SYNC_START' ||
      message.type === 'GLOBAL_SYNC_PUSH' ||
      message.type === 'GLOBAL_SYNC_PULL'
    ) {
      (async () => {
        const response = await handleSyncMessage(message);
        sendResponse(response);
      })();
      return true;
    }

    // Remote recording cache messages
    if (
      message.type === 'REMOTE_RECORDING_CACHE' ||
      message.type === 'REMOTE_RECORDING_GET' ||
      message.type === 'OPEN_PLAYER_TAB'
    ) {
      const response = handleRemoteRecordingMessage(message);
      sendResponse(response);
      return true;
    }

    // Proxy messages (Zen fetch, Jenkins API request)
    if (message.type === 'ZEN_FETCH_JSON' || message.type === 'JENKINS_API_REQUEST') {
      (async () => {
        const response = await handleProxyMessage(message);
        sendResponse(response);
      })();
      return true;
    }

    // Page Agent 注入
    if (message.type === 'PAGE_AGENT_INJECT') {
      (async () => {
        const response = await handlePageAgentInject(message);
        sendResponse(response);
      })();
      return true;
    }

    // Page Agent 获取配置（content script 调用）
    if (message.type === 'PAGE_AGENT_GET_CONFIG') {
      (async () => {
        const result = await browser.storage.session.get('__pageAgentConfig');
        const config = result.__pageAgentConfig;
        // 读取后立即清除，防止敏感信息泄露
        if (config) {
          await browser.storage.session.remove('__pageAgentConfig');
        }
        sendResponse({ config });
      })();
      return true;
    }

    // Page Agent 代理 fetch 请求（解决 CORS）
    if (message.type === 'PAGE_AGENT_FETCH') {
      (async () => {
        try {
          const { url, options } = message;

          const headers = serializeHeaders(options?.headers);

          const response = await fetch(url, {
            method: options?.method || 'POST',
            headers,
            body: options?.body,
          });

          const responseText = await response.text();

          let responseBody: unknown = null;
          try {
            responseBody = responseText ? JSON.parse(responseText) : null;
          } catch {
            responseBody = responseText;
          }

          sendResponse({
            success: true,
            ok: response.ok,
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            body: responseBody,
          });
        } catch (error) {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Fetch failed',
          });
        }
      })();
      return true;
    }
    // Open side panel request from popup
    if (message.type === 'OPEN_SIDE_PANEL') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (browser.sidePanel as any).open();
      sendResponse({ success: true });
      return true;
    }

    // Save Jenkins token (legacy)
    if (message.type === 'SAVE_JENKINS_TOKEN') {
      const { token, host, user } = message.payload;
      logger.debug('Received Jenkins token for:', host);

      (async () => {
        try {
          await updateSetting('jenkins_host', host);
          await updateSetting('jenkins_user', user);
          await updateSetting('jenkins_token', token);
          logger.debug('Jenkins settings saved');
          sendResponse({ success: true });
        } catch (e) {
          logger.error('Error saving settings:', e);
          sendResponse({ success: false, error: String(e) });
        }
      })();

      return true;
    }

    // Return false for unknown message types
    return false;
  });
});
