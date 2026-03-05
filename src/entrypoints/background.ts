import { browser } from 'wxt/browser';
import { type JenkinsEnvironment, db, syncEngine } from '@/db';
import { getJobDetails, triggerBuild } from '@/features/jenkins/api/build';
import { fetchAllJobs } from '@/features/jenkins/api/fetchJobs';
import { fetchMyBuilds } from '@/features/jenkins/api/fetchMyBuilds';
import type { JenkinsMessage, JenkinsResponse } from '@/features/jenkins/messages';
import { openLink } from '@/features/links/utils';
import type { RecorderMessage, RecordingSavedMessage } from '@/features/recorder/messages';
import type { RecordingState } from '@/features/recorder/types';
import { getSetting, updateSetting } from '@/lib/db/settings';
import { performGlobalSync } from '@/lib/globalSync';
import { logger } from '@/utils/logger';

async function getJenkinsCredentials(targetEnvId?: string) {
  const currentEnvId = await getSetting<string>('jenkins_current_env');
  const environments = (await getSetting<JenkinsEnvironment[]>('jenkins_environments')) || [];

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
  const host = await getSetting<string>('jenkins_host');
  const user = await getSetting<string>('jenkins_user');
  const token = await getSetting<string>('jenkins_token');

  if (!host || !user || !token) throw new Error('Jenkins credentials not configured');

  return { host, user, token, envId: 'default' };
}

const recordingStates = new Map<number, RecordingState>();
const remoteRecordingCache = new Map<
  string,
  { events: unknown[]; title: string; timestamp: number }
>();
const MAX_RECORDING_STATES = 100;

const CACHE_EXPIRY_MS = 5 * 60 * 1000;

export default defineBackground(() => {
  logger.info('Background started');

  // Setup side panel behavior - Chrome handles toggle automatically
  browser.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => logger.error('Failed to set side panel behavior:', error));

  const AUTO_SYNC_ALARM = 'auto-sync-alarm';

  // Manage auto sync alarm based on settings
  const setupAutoSync = async () => {
    try {
      const enabledSetting = await getSetting('auto_sync_enabled');
      const intervalSetting = await getSetting('auto_sync_interval');

      const enabled = enabledSetting !== undefined ? Boolean(enabledSetting) : true;
      const interval = typeof intervalSetting === 'number' ? intervalSetting : 30;

      if (enabled) {
        logger.info(`Setting up auto sync alarm for every ${interval} minutes`);
        if (browser.alarms)
          await browser.alarms.create(AUTO_SYNC_ALARM, { periodInMinutes: interval });
      } else {
        logger.info('Auto sync is disabled, clearing alarm');
        if (browser.alarms) await browser.alarms.clear(AUTO_SYNC_ALARM);
      }
    } catch (e) {
      logger.error('Failed to setup auto sync:', e);
    }
  };

  // Run initial setup
  setupAutoSync();

  // Listen for alarm
  if (browser.alarms) {
    browser.alarms.onAlarm.addListener(async (alarm) => {
      if (alarm.name === AUTO_SYNC_ALARM) {
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
    }
  });

  let lastPushTriggerTime = 0;
  let lastPullTriggerTime = 0;

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

  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'AUTO_SYNC_TRIGGER_PUSH') {
      const now = Date.now();
      if (now - lastPushTriggerTime < 3000) return false;
      lastPushTriggerTime = now;

      (async () => {
        const enabledSetting = await getSetting('auto_sync_enabled');
        if (enabledSetting !== undefined ? Boolean(enabledSetting) : true) {
          logger.info('Auto sync (push) triggered by data change');
          try {
            // First check if already syncing to avoid conflicts
            const status = await getSetting('global_sync_status');
            if (status === 'syncing') {
              logger.info('Skipping auto sync push: global sync is already in progress');
              return;
            }
            await updateSetting('global_sync_status', 'syncing');
            await syncEngine.push();
            await updateSetting('global_sync_status', 'idle');
          } catch (err) {
            logger.error('Auto sync push failed:', err);
            await updateSetting('global_sync_status', 'error');
            await updateSetting(
              'global_sync_error',
              err instanceof Error ? err.message : String(err)
            );
          }
        }
      })();
      return false;
    }

    if (message.type === 'AUTO_SYNC_TRIGGER_PULL') {
      const now = Date.now();
      if (now - lastPullTriggerTime < 500) {
        logger.debug('Throttled pull trigger');
        return false;
      }
      lastPullTriggerTime = now;

      (async () => {
        const enabledSetting = await getSetting('auto_sync_enabled');
        if (enabledSetting !== undefined ? Boolean(enabledSetting) : true) {
          logger.info('Auto sync (pull/global) triggered by UI open');
          try {
            // First check if already syncing to avoid conflicts
            const status = await getSetting('global_sync_status');
            if (status === 'syncing') {
              logger.info('Skipping auto sync on open: already syncing');
              return;
            }
            await performGlobalSync();
          } catch (err) {
            logger.error('Auto sync pull failed:', err);
          }
        }
      })();
      return false;
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
          await updateSetting('global_sync_status', 'syncing');
          await syncEngine.push();
          // Only reset to idle if we are managing the full sync lifecycle here.
          // But since these are called sequentially, it's safer to reset here to avoid stuck 'syncing' state if the chain breaks.
          await updateSetting('global_sync_status', 'idle');
          sendResponse({ success: true });
        } catch (err) {
          logger.error('Global sync push failed:', err);
          await updateSetting('global_sync_status', 'error');
          await updateSetting(
            'global_sync_error',
            err instanceof Error ? err.message : String(err)
          );
          sendResponse({ success: false, error: String(err) });
        }
      })();
      return true;
    }

    if (message.type === 'GLOBAL_SYNC_PULL') {
      (async () => {
        try {
          await updateSetting('global_sync_status', 'syncing');
          await syncEngine.pull();
          await updateSetting('global_sync_status', 'idle');
          sendResponse({ success: true });
        } catch (err) {
          logger.error('Global sync pull failed:', err);
          await updateSetting('global_sync_status', 'error');
          await updateSetting(
            'global_sync_error',
            err instanceof Error ? err.message : String(err)
          );
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

    if (message.type.startsWith('RECORDER_')) {
      const recorderMessage = message as RecorderMessage;
      (async () => {
        try {
          if (recorderMessage.type === 'RECORDER_START') {
            const { tabId } = recorderMessage;
            // Prevent memory leak by limiting recording states size
            if (recordingStates.size >= MAX_RECORDING_STATES) {
              const firstKey = recordingStates.keys().next().value;
              if (firstKey !== undefined) {
                recordingStates.delete(firstKey);
              }
            }
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

    // Zen Fetch JSON proxy - for fetching rrweb.json from remote URLs
    if (message.type === 'ZEN_FETCH_JSON') {
      const { url } = message.payload as { url: string };
      (async () => {
        try {
          const response = await fetch(url, { credentials: 'include' });
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          const data = await response.json();
          sendResponse({ success: true, data });
        } catch (e) {
          logger.error('ZEN_FETCH_JSON failed:', e);
          sendResponse({ success: false, error: e instanceof Error ? e.message : String(e) });
        }
      })();
      return true;
    }

    // Jenkins API Request proxy - for making Jenkins API calls from content script
    if (message.type === 'JENKINS_API_REQUEST') {
      const { url, options } = message.payload as {
        url: string;
        options?: {
          method?: string;
          headers?: Record<string, string>;
          body?: string;
          timeout?: number;
        };
      };
      (async () => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), options?.timeout || 30000);

          const response = await fetch(url, {
            method: options?.method || 'GET',
            headers: options?.headers,
            body: options?.body,
            signal: controller.signal,
            credentials: 'include',
          });

          clearTimeout(timeoutId);

          const data = await response.json();
          sendResponse({ success: true, status: response.status, data });
        } catch (e) {
          logger.error('JENKINS_API_REQUEST failed:', e);
          sendResponse({ success: false, error: e instanceof Error ? e.message : String(e) });
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
      const [allLinks, allLinkTags, allJobTags, allTags, allJobs, environments] = await Promise.all(
        [
          db.links.filter((l) => !l.deletedAt).toArray(),
          db.linkTags.filter((lt) => !lt.deletedAt).toArray(),
          db.jobTags.toArray(),
          db.tags.filter((t) => !t.deletedAt).toArray(),
          db.jobs.toArray(),
          getSetting<JenkinsEnvironment[]>('jenkins_environments').then((envs) => envs || []),
        ]
      );

      // Build tags map
      const tagsMap = new Map(allTags.map((t) => [t.id, t]));

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
          `/sidepanel.html?tab=jenkins&buildJobUrl=${encodeURIComponent(job.url)}&envId=${job.env || ''}`
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
