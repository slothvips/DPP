import { logger } from '@/utils/logger';
import {
  type OmniboxSuggestion,
  escapeOmniboxXml,
  loadOmniboxSearchData,
  parseOmniboxTerms,
} from './omniboxShared';

export async function searchOmnibox(text: string): Promise<OmniboxSuggestion[]> {
  try {
    const { envMap, jobTagsMap, jobs, linkTagsMap, links } = await loadOmniboxSearchData();
    const { keywords, tagFilters, terms } = parseOmniboxTerms(text);

    if (terms.length === 0) {
      return [];
    }

    const matchedLinks = links.filter((link) => {
      const name = (link.name || '').toLowerCase();
      const url = (link.url || '').toLowerCase();
      const tags = linkTagsMap.get(link.id) || [];
      const tagNames = tags.map((tag) => tag.name.toLowerCase());

      const matchesTags = tagFilters.every((filter) =>
        tagNames.some((tagName) => tagName.includes(filter))
      );
      if (!matchesTags) return false;

      return keywords.every(
        (keyword) =>
          name.includes(keyword) ||
          url.includes(keyword) ||
          tagNames.some((tagName) => tagName.includes(keyword))
      );
    });

    const matchedJobs = jobs.filter((job) => {
      const name = (job.name || '').toLowerCase();
      const url = (job.url || '').toLowerCase();
      const envName = (job.env ? envMap.get(job.env) : '')?.toLowerCase() || '';
      const tags = jobTagsMap.get(job.url) || [];
      const tagNames = tags.map((tag) => tag.name.toLowerCase());

      const matchesTags = tagFilters.every((filter) =>
        tagNames.some((tagName) => tagName.includes(filter))
      );
      if (!matchesTags) return false;

      return keywords.every(
        (keyword) =>
          name.includes(keyword) ||
          url.includes(keyword) ||
          envName.includes(keyword) ||
          tagNames.some((tagName) => tagName.includes(keyword))
      );
    });

    const linkSuggestions: OmniboxSuggestion[] = matchedLinks.map((link) => {
      const title = escapeOmniboxXml(link.name || '无标题');
      const linkUrl = escapeOmniboxXml(link.url || '');
      const tags = linkTagsMap.get(link.id) || [];
      const tagsStr =
        tags.length > 0
          ? ` <dim>#${tags.map((tag) => escapeOmniboxXml(tag.name)).join(' #')}</dim>`
          : '';

      return {
        content: link.url,
        description: `<dim>[链接]</dim> ${title} <dim>- ${linkUrl}</dim>${tagsStr}`,
      };
    });

    const jobSuggestions: OmniboxSuggestion[] = matchedJobs.map((job) => {
      const envName = job.env ? envMap.get(job.env) : undefined;
      const title = escapeOmniboxXml(job.name || '无名称');
      const jobUrl = escapeOmniboxXml(job.url || '');
      const envStr = envName ? ` <dim>@${escapeOmniboxXml(envName)}</dim>` : '';
      const tags = jobTagsMap.get(job.url) || [];
      const tagsStr =
        tags.length > 0
          ? ` <dim>#${tags.map((tag) => escapeOmniboxXml(tag.name)).join(' #')}</dim>`
          : '';

      return {
        content: job.url,
        description: `<dim>[构建]</dim> ${title} <dim>- ${jobUrl}</dim>${envStr}${tagsStr}`,
      };
    });

    return [...linkSuggestions, ...jobSuggestions];
  } catch (error) {
    logger.error('Omnibox search error:', error);
    return [];
  }
}
