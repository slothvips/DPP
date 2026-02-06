import { type JenkinsEnvironment, db } from '@/db';
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
  // @ts-expect-error - chrome.offscreen might not be in the types yet or browser-polyfill
  if (typeof chrome !== 'undefined' && chrome.offscreen) {
    // @ts-expect-error - getContexts is not in standard browser types
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
      // @ts-expect-error - WXT PublicPath type mismatch
      documentUrls: [browser.runtime.getURL(path)],
    });

    if (existingContexts.length > 0) {
      return;
    }

    // @ts-expect-error - offscreen is not in standard browser types
    await chrome.offscreen.createDocument({
      // @ts-expect-error - WXT PublicPath type mismatch
      url: browser.runtime.getURL(path),
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

  // Check for stuck sync status on startup
  db.settings.get('global_sync_status').then(async (status) => {
    if (status?.value === 'syncing') {
      logger.warn('Detected stuck sync status on startup. Resetting to idle.');
      await db.settings.put({ key: 'global_sync_status', value: 'idle' });
    }
  });

  browser.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
      browser.tabs.create({ url: browser.runtime.getURL('/guide.html') });
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

    // Return false for unknown message types
    return false;
  });

  browser.omnibox.setDefaultSuggestion({
    description: '搜索 DPP 链接: <match>%s</match>',
  });

  browser.omnibox.onInputChanged.addListener(async (text, suggest) => {
    if (!text) return;

    try {
      // Fetch all links with their tags, jobs, and settings
      const [allLinks, allLinkTags, allTags, allJobs, settings] = await Promise.all([
        db.links.filter((l) => !l.deletedAt).toArray(),
        db.linkTags.filter((lt) => !lt.deletedAt).toArray(),
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

      const keywords = text
        .toLowerCase()
        .split(' ')
        .filter((k) => k.trim().length > 0);

      if (keywords.length === 0) return;

      const matchedLinks = allLinks.filter((link) => {
        const name = (link.name || '').toLowerCase();
        const url = (link.url || '').toLowerCase();
        const tags = linkTagsMap.get(link.id) || [];
        const tagNames = tags.map((t) => t.name.toLowerCase());

        return keywords.every(
          (kw) => name.includes(kw) || url.includes(kw) || tagNames.some((tag) => tag.includes(kw))
        );
      });

      const matchedJobs = allJobs.filter((job) => {
        const name = (job.name || '').toLowerCase();
        const url = (job.url || '').toLowerCase();
        const envName = (job.env ? envMap.get(job.env) : '')?.toLowerCase() || '';

        return keywords.every(
          (kw) => name.includes(kw) || url.includes(kw) || envName.includes(kw)
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

      const linkSuggestions = matchedLinks.map((link) => ({
        content: link.url,
        description: `${escapeXml(link.name || '')} - <url>${escapeXml(link.url || '')}</url>`,
      }));

      const jobSuggestions = matchedJobs.map((job) => {
        const envName = job.env ? envMap.get(job.env) : undefined;
        const prefix = envName ? `[${envName}] ` : '[Job] ';
        return {
          content: job.url,
          description: `${escapeXml(prefix + (job.name || ''))} - <url>${escapeXml(job.url || '')}</url>`,
        };
      });

      const suggestions = [...linkSuggestions, ...jobSuggestions];

      if (suggestions.length === 0) {
        suggestions.push({
          content: 'https://github.com',
          description: 'No matches found - <url>https://github.com</url>',
        });
      }

      suggest(suggestions);
    } catch (e) {
      logger.error('Omnibox search error:', e);
      suggest([{ content: 'error', description: `Error: ${String(e)}` }]);
    }
  });

  browser.omnibox.onInputEntered.addListener((url) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      openLink(url);
    }
  });
});
