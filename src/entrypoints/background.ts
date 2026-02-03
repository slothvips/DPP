import { db } from '@/db';
import { getJobDetails, triggerBuild } from '@/features/jenkins/api/build';
import { fetchAllJobs } from '@/features/jenkins/api/fetchJobs';
import { fetchMyBuilds } from '@/features/jenkins/api/fetchMyBuilds';
import type { JenkinsMessage, JenkinsResponse } from '@/features/jenkins/messages';
import { openLink } from '@/features/links/utils';
import { performGlobalSync } from '@/lib/globalSync';
import { logger } from '@/utils/logger';

async function getJenkinsCredentials() {
  const settings = await db.settings.toArray();
  const host = settings.find((s) => s.key === 'jenkins_host')?.value as string;
  const user = settings.find((s) => s.key === 'jenkins_user')?.value as string;
  const token = settings.find((s) => s.key === 'jenkins_token')?.value as string;
  if (!host || !user || !token) throw new Error('Jenkins credentials not configured');
  return { host, user, token };
}

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

    if (message.type.startsWith('JENKINS_')) {
      const jenkinsMessage = message as JenkinsMessage;
      (async () => {
        try {
          const { host, user, token } = await getJenkinsCredentials();
          let data: unknown;

          switch (jenkinsMessage.type) {
            case 'JENKINS_FETCH_JOBS':
              data = await fetchAllJobs(host, user, token);
              break;
            case 'JENKINS_FETCH_MY_BUILDS':
              data = await fetchMyBuilds(host, user, token);
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
      // Fetch all links with their tags
      const [allLinks, allLinkTags, allTags] = await Promise.all([
        db.links.filter((l) => !l.deletedAt).toArray(),
        db.linkTags.filter((lt) => !lt.deletedAt).toArray(),
        db.tags.filter((t) => !t.deletedAt).toArray(),
      ]);

      // Build tags map
      const tagsMap = new Map(allTags.map((t) => [t.id, t]));

      // Build link -> tags mapping
      const linkTagsMap = new Map<string, { id: string; name: string }[]>();
      for (const lt of allLinkTags) {
        const tag = tagsMap.get(lt.tagId);
        if (tag) {
          const current = linkTagsMap.get(lt.linkId) || [];
          current.push({ id: tag.id, name: tag.name });
          linkTagsMap.set(lt.linkId, current);
        }
      }

      // Split search text into multiple keywords (支持多关键词搜索)
      const keywords = text
        .toLowerCase()
        .split(' ')
        .filter((k) => k.trim().length > 0);

      if (keywords.length === 0) return;

      const matches = allLinks.filter((link) => {
        const name = link.name.toLowerCase();
        const url = link.url.toLowerCase();
        const tags = linkTagsMap.get(link.id) || [];
        const tagNames = tags.map((t) => t.name.toLowerCase());

        // All keywords must match (AND logic) - search in name, url, and tags
        return keywords.every(
          (kw) => name.includes(kw) || url.includes(kw) || tagNames.some((tag) => tag.includes(kw))
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

      const suggestions = matches.map((link) => ({
        content: link.url,
        description: `${escapeXml(link.name)} - <url>${escapeXml(link.url)}</url>`,
      }));

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
