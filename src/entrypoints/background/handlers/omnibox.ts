// Omnibox search handlers for background script
import { browser } from 'wxt/browser';
import type { JenkinsEnvironment } from '@/db';
import { openLink } from '@/features/links/utils';
import { getAllJobs, getJob } from '@/lib/db/jenkins';
import { getAllActiveLinkTags, getAllActiveLinks } from '@/lib/db/links';
import { getSetting } from '@/lib/db/settings';
import { getAllActiveTags, getAllJobTags } from '@/lib/db/tags';
import { logger } from '@/utils/logger';

interface Suggestion {
  content: string;
  description: string;
}

/**
 * Search for links and jobs matching the text
 */
export async function searchOmnibox(text: string): Promise<Suggestion[]> {
  try {
    // Fetch all links with their tags, jobs, and settings
    const [allLinks, allLinkTags, allJobTags, allTags, allJobs, environments] = await Promise.all([
      getAllActiveLinks(),
      getAllActiveLinkTags(),
      getAllJobTags(),
      getAllActiveTags(),
      getAllJobs(),
      getSetting<JenkinsEnvironment[]>('jenkins_environments').then((envs) => envs || []),
    ]);

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
      const linkUrl = escapeXml(link.url || '');
      const tags = linkTagsMap.get(link.id) || [];
      const tagsStr =
        tags.length > 0 ? ` <dim>#${tags.map((t) => escapeXml(t.name)).join(' #')}</dim>` : '';

      return {
        content: link.url,
        description: `<dim>[链接]</dim> ${title} <dim>- ${linkUrl}</dim>${tagsStr}`,
      };
    });

    const jobSuggestions = matchedJobs.map((job) => {
      const envName = job.env ? envMap.get(job.env) : undefined;
      const title = escapeXml(job.name || '无名称');
      const jobUrl = escapeXml(job.url || '');
      const envStr = envName ? ` <dim>@${escapeXml(envName)}</dim>` : '';
      const tags = jobTagsMap.get(job.url) || [];
      const tagsStr =
        tags.length > 0 ? ` <dim>#${tags.map((t) => escapeXml(t.name)).join(' #')}</dim>` : '';

      return {
        content: job.url,
        description: `<dim>[构建]</dim> ${title} <dim>- ${jobUrl}</dim>${envStr}${tagsStr}`,
      };
    });

    return [...linkSuggestions, ...jobSuggestions];
  } catch (e) {
    logger.error('Omnibox search error:', e);
    return [];
  }
}

/**
 * Setup omnibox listeners
 */
export function setupOmnibox() {
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
      const job = await getJob({ jobUrl: url });
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
}
