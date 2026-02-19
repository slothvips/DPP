import { browser } from 'wxt/browser';
import { type JenkinsEnvironment, db, syncEngine } from '@/db';
import { getJobDetails, triggerBuild } from '@/features/jenkins/api/build';
import { fetchAllJobs } from '@/features/jenkins/api/fetchJobs';
import { fetchMyBuilds } from '@/features/jenkins/api/fetchMyBuilds';
import type { JenkinsMessage, JenkinsResponse } from '@/features/jenkins/messages';
import { openLink } from '@/features/links/utils';
import type { RecorderMessage, RecordingSavedMessage } from '@/features/recorder/messages';
import type { RecordingState } from '@/features/recorder/types';
import { performGlobalSync } from '@/lib/globalSync';
import { logger } from '@/utils/logger';

async function getJenkinsCredentials(targetEnvId?: string) {
  const settings = await db.settings.toArray();
  const currentEnvId = settings.find((s) => s.key === 'jenkins_current_env')?.value as string;
  const environments =
    (settings.find((s) => s.key === 'jenkins_environments')?.value as JenkinsEnvironment[]) || [];

  if (targetEnvId) {
    const env = environments.find((e) => e.id === targetEnvId);
    if (!env) {
      throw new Error(`Jenkins environment not found: ${targetEnvId}`);
    }
    return { host: env.host, user: env.user, token: env.token, envId: env.id };
  }

  if (currentEnvId && environments.length > 0) {
    const env = environments.find((e) => e.id === currentEnvId);
    if (env) {
      return { host: env.host, user: env.user, token: env.token, envId: env.id };
    }
  }

  // Fallback to legacy settings
  const host = settings.find((s) => s.key === 'jenkins_host')?.value as string;
  const user = settings.find((s) => s.key === 'jenkins_user')?.value as string;
  const token = settings.find((s) => s.key === 'jenkins_token')?.value as string;

  if (!host || !user || !token) throw new Error('Jenkins credentials not configured');

  return { host, user, token, envId: 'default' };
}

async function setupOffscreenDocument(path: string) {
  if (browser.offscreen) {
    const existingContexts = await browser.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
      documentUrls: [browser.runtime.getURL(path as '/offscreen.html')],
    });

    if (existingContexts.length > 0) {
      return;
    }

    await browser.offscreen.createDocument({
      url: browser.runtime.getURL(path as '/offscreen.html'),
      reasons: ['DISPLAY_MEDIA'],
      justification: 'Recording screen for user productivity tool',
    });
  }
}

async function sendMessageToOffscreenWithRetry(message: unknown, maxRetries = 10, delay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await browser.runtime.sendMessage(message);
      return;
    } catch (e) {
      const errorMsg = String(e);
      if (
        (errorMsg.includes('Could not establish connection') ||
          errorMsg.includes('Receiving end does not exist')) &&
        i < maxRetries - 1
      ) {
        logger.warn('Offscreen not ready yet, retrying...', { attempt: i + 1, error: errorMsg });
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw e;
    }
  }
}

const recordingStates = new Map<number, RecordingState>();
const remoteRecordingCache = new Map<
  string,
  { events: unknown[]; title: string; timestamp: number }
>();

const CACHE_EXPIRY_MS = 5 * 60 * 1000;

export default defineBackground(() => {
  logger.info('Background started');

  // Track side panel state per window
  const sidePanelEnabled = new Map<number, boolean>();

  // Handle extension icon click - toggle side panel
  browser.action.onClicked.addListener(async (tab) => {
    const windowId = tab.windowId;
    logger.info('Action clicked, windowId:', windowId);

    try {
      const isEnabled = sidePanelEnabled.get(windowId) ?? false;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sidePanel = browser.sidePanel as any;

      if (isEnabled) {
        // Close: set enabled to false
        await sidePanel.setOptions({ enabled: false });
        sidePanelEnabled.set(windowId, false);
        logger.info('Side panel disabled for window:', windowId);
      } else {
        // Open: try both in parallel within the same event loop tick
        // This keeps them in the same user gesture context
        const enablePromise = sidePanel.setOptions({ enabled: true });
        const openPromise = browser.sidePanel.open({ windowId });
        await Promise.all([enablePromise, openPromise]);
        sidePanelEnabled.set(windowId, true);
        logger.info('Side panel enabled and opened for window:', windowId);
      }
    } catch (e) {
      logger.error('Failed to toggle side panel:', e);
    }
  });

  // Create context menu on extension install/update
  browser.runtime.onInstalled.addListener(() => {
    logger.info('[DPP] Extension installed/updated, creating context menu');

    // Use browser API for context menus
    if (browser.contextMenus) {
      // Remove existing menus first
      browser.contextMenus
        .removeAll()
        .then(() => {
          // Add "Open Side Panel" menu item
          browser.contextMenus.create({
            id: 'open-sidepanel',
            title: '打开侧边栏 (AI 助手)',
            contexts: ['action'],
          });
        })
        .catch((err: unknown) => {
          logger.warn('[DPP] Failed to create context menu:', err);
        });
    } else {
      logger.warn('[DPP] contextMenus API not available');
    }
  });

  // Handle context menu clicks
  if (browser.contextMenus?.onClicked) {
    browser.contextMenus.onClicked.addListener((info, _tab) => {
      if (info.menuItemId === 'open-sidepanel') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (browser.sidePanel as any).open();
      }
    });
  }

  // Check for stuck sync status on startup
  db.settings.get('global_sync_status').then(async (status) => {
    if (status?.value === 'syncing') {
      logger.warn('Detected stuck sync status on startup. Resetting to idle.');
      await db.settings.put({ key: 'global_sync_status', value: 'idle' });
    }
  });

  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'OFFSCREEN_RECORDING_START_WITH_ID') {
      (async () => {
        try {
          await setupOffscreenDocument('offscreen.html');
          await sendMessageToOffscreenWithRetry({
            target: 'offscreen',
            type: 'START_RECORDING',
            streamId: message.streamId,
          });
          sendResponse({ success: true });
        } catch (e) {
          logger.error('Failed to start offscreen recording with ID:', e);
          sendResponse({ success: false, error: String(e) });
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

    if (message.type === 'GLOBAL_SYNC_START') {
      performGlobalSync()
        .then(() => {
          sendResponse({ success: true });
        })
        .catch((err) => {
          logger.error('Global sync failed:', err);
          sendResponse({ success: false, error: err instanceof Error ? err.message : String(err) });
        });
      return true;
    }

    if (message.type === 'GLOBAL_SYNC_PUSH') {
      (async () => {
        try {
          await db.settings.put({ key: 'global_sync_status', value: 'syncing' });
          await syncEngine.push();
          // Only reset to idle if we are managing the full sync lifecycle here.
          // But since these are called sequentially, it's safer to reset here to avoid stuck 'syncing' state if the chain breaks.
          await db.settings.put({ key: 'global_sync_status', value: 'idle' });
          sendResponse({ success: true });
        } catch (err) {
          logger.error('Global sync push failed:', err);
          await db.settings.put({ key: 'global_sync_status', value: 'error' });
          await db.settings.put({
            key: 'global_sync_error',
            value: err instanceof Error ? err.message : String(err),
          });
          sendResponse({ success: false, error: String(err) });
        }
      })();
      return true;
    }

    if (message.type === 'GLOBAL_SYNC_PULL') {
      (async () => {
        try {
          await db.settings.put({ key: 'global_sync_status', value: 'syncing' });
          await syncEngine.pull();
          await db.settings.put({ key: 'global_sync_status', value: 'idle' });
          sendResponse({ success: true });
        } catch (err) {
          logger.error('Global sync pull failed:', err);
          await db.settings.put({ key: 'global_sync_status', value: 'error' });
          await db.settings.put({
            key: 'global_sync_error',
            value: err instanceof Error ? err.message : String(err),
          });
          sendResponse({ success: false, error: String(err) });
        }
      })();
      return true;
    }

    if (message.type === 'REMOTE_RECORDING_CACHE') {
      const { cacheId, events, title } = message.payload as {
        cacheId: string;
        events: unknown[];
        title: string;
      };
      remoteRecordingCache.set(cacheId, { events, title, timestamp: Date.now() });
      logger.debug('Cached remote recording:', cacheId, 'events:', events.length);
      sendResponse({ success: true });
      return true;
    }

    if (message.type === 'REMOTE_RECORDING_GET') {
      const { cacheId } = message.payload as { cacheId: string };
      const cached = remoteRecordingCache.get(cacheId);

      if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY_MS) {
        sendResponse({ success: true, events: cached.events, title: cached.title });
        setTimeout(() => remoteRecordingCache.delete(cacheId), 5000);
      } else {
        if (cached) remoteRecordingCache.delete(cacheId);
        sendResponse({ success: false, error: 'Cache expired or not found' });
      }
      return true;
    }

    if (message.type === 'OPEN_PLAYER_TAB') {
      const { cacheId } = message.payload as { cacheId: string };
      const playerUrl = browser.runtime.getURL(`/player.html?cache=${cacheId}`);
      browser.tabs.create({ url: playerUrl });
      sendResponse({ success: true });
      return true;
    }

    if (message.type === 'PREVIEW_OPEN') {
      logger.info('Received PREVIEW_OPEN message');
      browser.tabs.create({ url: browser.runtime.getURL('/preview.html') });
      sendResponse({ success: true });
      return true;
    }

    if (message.type === 'PREVIEW_SIGNAL') {
      browser.runtime.sendMessage(message).catch(() => {});
      sendResponse({ success: true });
      return true;
    }

    if (message.type === 'SAVE_JENKINS_TOKEN') {
      const { token, host, user } = message.payload;
      logger.debug('Received Jenkins token for:', host);

      (async () => {
        try {
          await db.settings.put({ key: 'jenkins_host', value: host });
          await db.settings.put({ key: 'jenkins_user', value: user });
          await db.settings.put({ key: 'jenkins_token', value: token });
          logger.debug('Jenkins settings saved');
          sendResponse({ success: true });
        } catch (e) {
          logger.error('Error saving settings:', e);
          sendResponse({ success: false, error: String(e) });
        }
      })();

      return true;
    }

    if (message.type.startsWith('RECORDER_')) {
      const recorderMessage = message as RecorderMessage;
      (async () => {
        try {
          if (recorderMessage.type === 'RECORDER_START') {
            const { tabId } = recorderMessage;
            recordingStates.set(tabId, { isRecording: true, startTime: Date.now(), tabId });
            try {
              await browser.tabs.sendMessage(tabId, { type: 'RECORDER_INJECT' });
              sendResponse({ success: true });
            } catch (e) {
              logger.warn(`Failed to inject recorder on tab ${tabId}:`, e);
              recordingStates.delete(tabId);
              sendResponse({ success: false, error: 'Content script not ready' });
            }
          } else if (recorderMessage.type === 'RECORDER_STOP') {
            const { tabId } = recorderMessage;
            try {
              await browser.tabs.sendMessage(tabId, { type: 'RECORDER_STOP_CAPTURE' });
              sendResponse({ success: true });
            } catch (e) {
              logger.warn(`Failed to stop recorder on tab ${tabId}:`, e);
              recordingStates.delete(tabId);
              sendResponse({ success: false, error: 'Lost connection to tab' });
            }
          } else if (recorderMessage.type === 'RECORDER_GET_STATUS') {
            const { tabId } = recorderMessage;
            const state = recordingStates.get(tabId) || { isRecording: false };
            logger.debug('Recorder status requested:', { tabId, state });
            sendResponse(state);
          } else if (recorderMessage.type === 'RECORDER_GET_STATUS_FOR_CONTENT') {
            const tabId = _sender.tab?.id;
            if (tabId) {
              const state = recordingStates.get(tabId) || { isRecording: false };
              sendResponse(state);
            } else {
              sendResponse({ isRecording: false });
            }
          } else if (recorderMessage.type === 'RECORDER_GET_ALL_RECORDINGS') {
            try {
              const recordings = await db.recordings.orderBy('createdAt').reverse().toArray();
              const metas = recordings.map(({ events: _events, ...meta }) => meta);
              sendResponse({ success: true, recordings: metas });
            } catch (e) {
              sendResponse({ success: false, error: String(e) });
            }
          } else if (recorderMessage.type === 'RECORDER_GET_RECORDING_BY_ID') {
            try {
              const recording = await db.recordings.get(recorderMessage.id);
              if (recording) {
                sendResponse({ success: true, recording });
              } else {
                sendResponse({ success: false, error: 'Recording not found' });
              }
            } catch (e) {
              sendResponse({ success: false, error: String(e) });
            }
          } else if (recorderMessage.type === 'RECORDER_REQUEST_STREAM') {
            (async () => {
              try {
                await setupOffscreenDocument('offscreen.html');
                await sendMessageToOffscreenWithRetry({
                  target: 'offscreen',
                  type: 'START_RECORDING',
                });
                sendResponse({ success: true });
              } catch (e) {
                logger.error('Failed to start offscreen recording:', e);
                sendResponse({ success: false, error: String(e) });
              }
            })();
          } else if (recorderMessage.type === 'RECORDER_COMPLETE') {
            const { events, url, favicon, duration } = recorderMessage;
            const tabId = _sender.tab?.id;

            if (tabId) {
              recordingStates.delete(tabId);

              const id = crypto.randomUUID();
              const recording = {
                id,
                title: `Recording - ${new Date().toLocaleString()}`,
                url,
                favicon,
                createdAt: Date.now(),
                duration,
                eventsCount: events.length,
                fileSize: JSON.stringify(events).length,
                events,
              };

              await db.recordings.add(recording);

              const savedMessage: RecordingSavedMessage = {
                type: 'RECORDER_SAVED',
                recordingId: id,
              };
              browser.runtime.sendMessage(savedMessage).catch(() => {});
              sendResponse({ success: true, recordingId: id });
            } else {
              sendResponse({ success: false, error: 'No tab ID' });
            }
          }
        } catch (e) {
          logger.error('Recorder error:', e);
          sendResponse({ success: false, error: String(e) });
        }
      })();
      return true;
    }

    if (message.type.startsWith('JENKINS_')) {
      const jenkinsMessage = message as JenkinsMessage;
      (async () => {
        try {
          const targetEnvId = (jenkinsMessage.payload as { envId?: string } | undefined)?.envId;
          const { host, user, token, envId } = await getJenkinsCredentials(targetEnvId);
          let data: unknown;

          switch (jenkinsMessage.type) {
            case 'JENKINS_FETCH_JOBS':
              data = await fetchAllJobs(host, user, token, envId);
              break;
            case 'JENKINS_FETCH_MY_BUILDS':
              data = await fetchMyBuilds(host, user, token, envId);
              break;
            case 'JENKINS_TRIGGER_BUILD': {
              const { jobUrl, parameters } = jenkinsMessage.payload;
              data = await triggerBuild(jobUrl, user, token, host, parameters);
              break;
            }
            case 'JENKINS_GET_JOB_DETAILS': {
              const { jobUrl } = jenkinsMessage.payload;
              data = await getJobDetails(jobUrl, user, token);
              break;
            }
          }
          const response: JenkinsResponse = { success: true, data };
          sendResponse(response);
        } catch (e) {
          const err = e as Error;
          logger.error(`Jenkins action ${jenkinsMessage.type} failed:`, err);
          const response: JenkinsResponse = { success: false, error: err.message || String(e) };
          sendResponse(response);
        }
      })();
      return true;
    }

    // CDP Permission handlers - browser.debugger API is only available in background
    if (message.type === 'CDP_CHECK_STATUS') {
      logger.info('[Permission] CDP_CHECK_STATUS received');
      (async () => {
        try {
          const targets = await browser.debugger.getTargets();
          logger.info('[Permission] getTargets result:', targets?.length);
          sendResponse({ status: 'granted' });
        } catch (e) {
          const errorMsg = e instanceof Error ? e.message : String(e);
          logger.error('[Permission] CDP_CHECK_STATUS error:', errorMsg);
          if (errorMsg.includes('Permission') || errorMsg.includes('denied')) {
            sendResponse({ status: 'denied', error: errorMsg });
          } else {
            sendResponse({ status: 'prompt', error: errorMsg });
          }
        }
      })();
      return true;
    }

    if (message.type === 'CDP_PROBE_PERMISSION') {
      logger.info('[Permission] CDP_PROBE_PERMISSION received');
      (async () => {
        try {
          // Try to attach to a non-existent tab to trigger permission check
          await browser.debugger.attach({ tabId: 0 }, '1.0');
          sendResponse({ status: 'granted' });
        } catch (e) {
          const errorMsg = e instanceof Error ? e.message : String(e);
          logger.info('[Permission] probe attach error:', errorMsg);
          if (errorMsg.includes('Permission denied') || errorMsg.includes('denied')) {
            sendResponse({ status: 'denied', error: errorMsg });
          } else if (errorMsg.includes('Extension permission') || errorMsg.includes('debugger')) {
            sendResponse({ status: 'prompt', error: errorMsg });
          } else {
            // Other errors - permission might be granted but tab doesn't exist
            sendResponse({ status: 'granted' });
          }
        }
      })();
      return true;
    }

    if (message.type === 'CDP_REQUEST_PERMISSION') {
      logger.info('[Permission] CDP_REQUEST_PERMISSION received');
      // Helper to check if URL is allowed for debugging
      const isDebuggableUrl = (url: string | undefined) => {
        if (!url) return false;
        return (
          !url.startsWith('chrome://') &&
          !url.startsWith('about:') &&
          !url.startsWith('devtools://')
        );
      };

      // Get the current active tab
      browser.tabs
        .query({ active: true, currentWindow: true })
        .then(async (tabs) => {
          let tab = tabs[0];
          logger.info('[Permission] Current tab:', tab?.id, tab?.url);

          if (!tab || tab.id === undefined) {
            sendResponse({ granted: false, error: 'No active tab found' });
            return;
          }

          // Check if current tab is a chrome:// URL - need a regular web page
          if (!isDebuggableUrl(tab.url)) {
            logger.info('[Permission] Current tab is not debuggable, looking for another tab');
            // Try to find a debuggable tab
            const allTabs = await browser.tabs.query({});
            const debuggableTab = allTabs.find((t) => t.id !== undefined && isDebuggableUrl(t.url));
            if (debuggableTab) {
              tab = debuggableTab;
              logger.info('[Permission] Using debuggable tab:', tab.id, tab.url);
            } else {
              sendResponse({
                granted: false,
                error:
                  '请切换到任意网页标签页（如 https://example.com）后再试。Chrome 扩展页面无法被调试。',
              });
              return;
            }
          }

          // Try to attach - this will prompt for permission if needed
          try {
            await browser.debugger.attach({ tabId: tab.id }, '1.0');
            // Success - detach to clean up
            await browser.debugger.detach({ tabId: tab.id });
            sendResponse({ granted: true });
          } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            logger.info('[Permission] Attach result:', errorMsg);
            sendResponse({ granted: false, error: errorMsg });
          }
        })
        .catch((e) => {
          logger.error('[Permission] Error getting tab:', e);
          sendResponse({ granted: false, error: String(e) });
        });
      return true;
    }

    // CDP Command handlers - browser.debugger API is only available in background
    if (message.type === 'CDP_ATTACH') {
      logger.info('[CDP] CDP_ATTACH received');
      (async () => {
        try {
          let tabId = message.tabId;

          // Get active tab if not provided
          if (!tabId) {
            const tabs = await browser.tabs.query({ active: true, currentWindow: true });
            const tab = tabs[0];
            if (!tab || tab.id === undefined) {
              sendResponse({ success: false, error: 'No active tab found' });
              return;
            }
            tabId = tab.id;
          }

          // Attach debugger
          await browser.debugger.attach({ tabId }, '1.0');

          // Set up event forwarding
          const handleEvent = (
            source: chrome.debugger.DebuggerSession,
            method: string,
            params?: object
          ) => {
            if (source.tabId === tabId) {
              browser.runtime
                .sendMessage({
                  type: 'CDP_EVENT',
                  method,
                  params: params || {},
                })
                .catch(() => {});
            }
          };

          const handleDetach = (source: chrome.debugger.Debuggee, reason: string) => {
            if (source.tabId === tabId) {
              browser.debugger.onEvent.removeListener(handleEvent);
              browser.debugger.onDetach.removeListener(handleDetach);
              browser.runtime
                .sendMessage({
                  type: 'CDP_EVENT',
                  method: 'Debugger.detached',
                  params: { reason },
                })
                .catch(() => {});
            }
          };

          browser.debugger.onEvent.addListener(handleEvent);
          browser.debugger.onDetach.addListener(handleDetach);

          logger.info(`[CDP] Attached to tab ${tabId}`);
          sendResponse({ success: true, tabId });
        } catch (e) {
          logger.error('[CDP] CDP_ATTACH error:', e);
          sendResponse({ success: false, error: String(e) });
        }
      })();
      return true;
    }

    if (message.type === 'CDP_DETACH') {
      logger.info('[CDP] CDP_DETACH received');
      const { tabId } = message;
      (async () => {
        try {
          await browser.debugger.detach({ tabId });
          logger.info(`[CDP] Detached from tab ${tabId}`);
          sendResponse({ success: true });
        } catch (e) {
          logger.error('[CDP] CDP_DETACH error:', e);
          sendResponse({ success: false, error: String(e) });
        }
      })();
      return true;
    }

    if (message.type === 'CDP_SEND_COMMAND') {
      const { tabId, method, params, id } = message;
      logger.debug(`[CDP] CDP_SEND_COMMAND: ${method}`);

      (async () => {
        try {
          const result = await browser.debugger.sendCommand({ tabId }, method, params);
          // Send response back
          browser.runtime
            .sendMessage({
              type: 'CDP_RESPONSE',
              method,
              params: result || {},
              id,
            })
            .catch(() => {});
          // For async commands, we just acknowledge the send
          sendResponse({ success: true });
        } catch (e) {
          const errorMsg = e instanceof Error ? e.message : String(e);
          logger.error(`[CDP] Command error: ${method}`, errorMsg);
          sendResponse({ success: false, error: errorMsg });
        }
      })();
      return true;
    }

    // Return false for unknown message types
    return false;
  });

  const searchOmnibox = async (text: string) => {
    try {
      // Fetch all links with their tags, jobs, and settings
      const [allLinks, allLinkTags, allJobTags, allTags, allJobs, settings] = await Promise.all([
        db.links.filter((l) => !l.deletedAt).toArray(),
        db.linkTags.filter((lt) => !lt.deletedAt).toArray(),
        db.jobTags.toArray(),
        db.tags.filter((t) => !t.deletedAt).toArray(),
        db.jobs.toArray(),
        db.settings.toArray(),
      ]);

      // Build tags map
      const tagsMap = new Map(allTags.map((t) => [t.id, t]));

      const environments =
        (settings.find((s) => s.key === 'jenkins_environments')?.value as JenkinsEnvironment[]) ||
        [];
      const envMap = new Map(environments.map((e) => [e.id, e.name]));

      const linkTagsMap = new Map<string, { id: string; name: string }[]>();
      for (const lt of allLinkTags) {
        const tag = tagsMap.get(lt.tagId);
        if (tag) {
          const current = linkTagsMap.get(lt.linkId) || [];
          current.push({ id: tag.id, name: tag.name });
          linkTagsMap.set(lt.linkId, current);
        }
      }

      const jobTagsMap = new Map<string, { id: string; name: string }[]>();
      for (const jt of allJobTags) {
        if (jt.deletedAt) continue;
        const tag = tagsMap.get(jt.tagId);
        if (tag) {
          const current = jobTagsMap.get(jt.jobUrl) || [];
          current.push({ id: tag.id, name: tag.name });
          jobTagsMap.set(jt.jobUrl, current);
        }
      }

      const terms = text
        .toLowerCase()
        .split(' ')
        .filter((k) => k.trim().length > 0);
      if (terms.length === 0) return [];

      // Separate tag filters (starting with #) from general keywords
      const tagFilters = terms
        .filter((t) => t.startsWith('#') && t.length > 1)
        .map((t) => t.slice(1));
      const keywords = terms.filter((t) => !t.startsWith('#'));

      const matchedLinks = allLinks.filter((link) => {
        const name = (link.name || '').toLowerCase();
        const url = (link.url || '').toLowerCase();
        const tags = linkTagsMap.get(link.id) || [];
        const tagNames = tags.map((t) => t.name.toLowerCase());

        // 1. Must match all tag filters
        const matchesTags = tagFilters.every((filter) =>
          tagNames.some((tagName) => tagName.includes(filter))
        );
        if (!matchesTags) return false;

        // 2. Must match all general keywords (in name, url, or tags)
        return keywords.every(
          (kw) => name.includes(kw) || url.includes(kw) || tagNames.some((tag) => tag.includes(kw))
        );
      });

      const matchedJobs = allJobs.filter((job) => {
        const name = (job.name || '').toLowerCase();
        const url = (job.url || '').toLowerCase();
        const envName = (job.env ? envMap.get(job.env) : '')?.toLowerCase() || '';
        const tags = jobTagsMap.get(job.url) || [];
        const tagNames = tags.map((t) => t.name.toLowerCase());

        // 1. Must match all tag filters
        const matchesTags = tagFilters.every((filter) =>
          tagNames.some((tagName) => tagName.includes(filter))
        );
        if (!matchesTags) return false;

        // 2. Must match all general keywords
        return keywords.every(
          (kw) =>
            name.includes(kw) ||
            url.includes(kw) ||
            envName.includes(kw) ||
            tagNames.some((tag) => tag.includes(kw))
        );
      });

      const escapeXml = (str: string) =>
        str.replace(/[<>&'"]/g, (c) => {
          switch (c) {
            case '<':
              return '&lt;';
            case '>':
              return '&gt;';
            case '&':
              return '&amp;';
            case "'":
              return '&apos;';
            case '"':
              return '&quot;';
            default:
              return c;
          }
        });

      const linkSuggestions = matchedLinks.map((link) => {
        const title = escapeXml(link.name || '无标题');
        const url = escapeXml(link.url || '');
        const tags = linkTagsMap.get(link.id) || [];
        const tagsStr =
          tags.length > 0 ? ` <dim>#${tags.map((t) => escapeXml(t.name)).join(' #')}</dim>` : '';

        return {
          content: link.url,
          description: `<dim>[链接]</dim> ${title} <dim>- ${url}</dim>${tagsStr}`,
        };
      });

      const jobSuggestions = matchedJobs.map((job) => {
        const envName = job.env ? envMap.get(job.env) : undefined;
        const title = escapeXml(job.name || '无名称');
        const url = escapeXml(job.url || '');
        const envStr = envName ? ` <dim>@${escapeXml(envName)}</dim>` : '';
        const tags = jobTagsMap.get(job.url) || [];
        const tagsStr =
          tags.length > 0 ? ` <dim>#${tags.map((t) => escapeXml(t.name)).join(' #')}</dim>` : '';

        return {
          content: job.url,
          description: `<dim>[构建]</dim> ${title} <dim>- ${url}</dim>${envStr}${tagsStr}`,
        };
      });

      return [...linkSuggestions, ...jobSuggestions];
    } catch (e) {
      logger.error('Omnibox search error:', e);
      return [];
    }
  };

  browser.omnibox.onInputChanged.addListener(async (text, suggest) => {
    if (!text) return;

    const suggestions = await searchOmnibox(text);

    if (suggestions.length > 0) {
      // Set the first suggestion as the default one to avoid duplication
      const first = suggestions[0];
      browser.omnibox.setDefaultSuggestion({
        description: first.description,
      });
      // Show the rest in the dropdown
      suggest(suggestions.slice(1));
    } else {
      browser.omnibox.setDefaultSuggestion({
        description: '没有找到匹配项',
      });
      suggest([]);
    }
  });

  browser.omnibox.onInputEntered.addListener(async (text) => {
    let url = text;

    // If the input is not a URL, try to find a match
    if (!text.startsWith('http://') && !text.startsWith('https://')) {
      const suggestions = await searchOmnibox(text);
      if (suggestions.length > 0) {
        url = suggestions[0].content;
      }
    }

    // Check if the URL corresponds to a known Job
    try {
      const job = await db.jobs.get(url);
      if (job) {
        // It's a job, open the extension popup page with parameters to trigger build
        const popupUrl = browser.runtime.getURL(
          `/popup.html?tab=jenkins&buildJobUrl=${encodeURIComponent(job.url)}&envId=${job.env || ''}`
        );

        // Open as a small popup window instead of a full tab
        browser.windows.create({
          url: popupUrl,
          type: 'popup',
          width: 800,
          height: 600,
        });
        return;
      }
    } catch (e) {
      logger.error('Error checking job for omnibox navigation:', e);
    }

    if (url.startsWith('http://') || url.startsWith('https://')) {
      openLink(url);
    }
  });
});
