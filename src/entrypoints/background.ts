// Background script - Main entry point
// This file handles message routing and delegates to handler modules
import { browser } from 'wxt/browser';
import { getSetting, updateSetting } from '@/lib/db/settings';
import { performGlobalSync } from '@/lib/globalSync';
import { logger } from '@/utils/logger';
import {
  handleGeneralMessage,
  handleJenkinsMessage,
  handlePageAgentExecute,
  handlePageAgentExecuteTaskWithTab,
  handlePageAgentInject,
  handlePageAgentInjectWithTab,
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
      setupAutoSync().catch((e) => logger.error('Failed to setup auto sync:', e));
    }
    return false;
  });

  // Check for stuck sync status on startup
  getSetting('global_sync_status')
    .then(async (status) => {
      if (status === 'syncing') {
        logger.warn('Detected stuck sync status on startup. Resetting to idle.');
        await updateSetting('global_sync_status', 'idle');
        await updateSetting('global_sync_error', '');
      }
    })
    .catch((e) => {
      logger.error('Failed to check sync status on startup:', e);
    });

  // Network online event - trigger auto sync
  if (typeof globalThis !== 'undefined') {
    globalThis.addEventListener('online', () => {
      logger.info('Network online, triggering global auto sync');
      getSetting('auto_sync_enabled')
        .then((enabledSetting) => {
          if (enabledSetting !== undefined ? Boolean(enabledSetting) : true) {
            performGlobalSync().catch((e) => logger.error('Online auto sync failed:', e));
          }
        })
        .catch((e) => {
          logger.error('Failed to get auto sync setting:', e);
        });
    });
  }

  // Setup omnibox listeners
  setupOmnibox();

  // Main message router - strategy pattern
  type MessageHandler = (
    message: {
      type: string;
      payload?: unknown;
    },
    sender?: unknown
  ) => unknown;

  const messageHandlers: Array<{
    match: (type: string) => boolean;
    handler: MessageHandler;
  }> = [
    {
      match: (type) => type.startsWith('JENKINS_'),
      handler: (message) =>
        handleJenkinsMessage(message as Parameters<typeof handleJenkinsMessage>[0]),
    },
    {
      match: (type) => type.startsWith('RECORDER_'),
      handler: (message, sender) =>
        handleRecorderMessage(
          message as Parameters<typeof handleRecorderMessage>[0],
          sender as Parameters<typeof handleRecorderMessage>[1]
        ),
    },
    {
      match: (type) =>
        type === 'AUTO_SYNC_TRIGGER_PUSH' ||
        type === 'AUTO_SYNC_TRIGGER_PULL' ||
        type === 'GLOBAL_SYNC_START' ||
        type === 'GLOBAL_SYNC_PUSH' ||
        type === 'GLOBAL_SYNC_PULL',
      handler: (message) => handleSyncMessage(message as Parameters<typeof handleSyncMessage>[0]),
    },
    {
      match: (type) =>
        type === 'REMOTE_RECORDING_CACHE' ||
        type === 'REMOTE_RECORDING_GET' ||
        type === 'OPEN_PLAYER_TAB',
      handler: (message) =>
        handleRemoteRecordingMessage(message as Parameters<typeof handleRemoteRecordingMessage>[0]),
    },
    {
      match: (type) => type === 'ZEN_FETCH_JSON' || type === 'JENKINS_API_REQUEST',
      handler: (message) => handleProxyMessage(message as Parameters<typeof handleProxyMessage>[0]),
    },
    {
      match: (type) => type === 'PAGE_AGENT_INJECT',
      handler: (message) =>
        handlePageAgentInject(message as Parameters<typeof handlePageAgentInject>[0]),
    },
    {
      match: (type) => type === 'PAGE_AGENT_INJECT_WITH_TAB',
      handler: (message) =>
        handlePageAgentInjectWithTab(message as Parameters<typeof handlePageAgentInjectWithTab>[0]),
    },
    {
      match: (type) => type === 'PAGE_AGENT_EXECUTE_TASK',
      handler: (message) =>
        handlePageAgentExecute(message as Parameters<typeof handlePageAgentExecute>[0]),
    },
    {
      match: (type) => type === 'PAGE_AGENT_EXECUTE_TASK_WITH_TAB',
      handler: (message) =>
        handlePageAgentExecuteTaskWithTab(
          message as Parameters<typeof handlePageAgentExecuteTaskWithTab>[0]
        ),
    },
    {
      match: (type) =>
        type === 'PAGE_AGENT_GET_CONFIG' ||
        type === 'PAGE_AGENT_FETCH' ||
        type === 'OPEN_SIDE_PANEL' ||
        type === 'SAVE_JENKINS_TOKEN',
      handler: (message) =>
        handleGeneralMessage(message as Parameters<typeof handleGeneralMessage>[0]),
    },
  ];

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const messageType = message.type as string;

    for (const { match, handler } of messageHandlers) {
      if (match(messageType)) {
        const result = handler(message as { type: string; payload?: unknown }, sender);
        if (result instanceof Promise) {
          result.then(sendResponse);
        } else {
          sendResponse(result);
        }
        return true;
      }
    }

    return false;
  });
});
