import { getAllJobs } from '@/lib/db/jenkins';
import { getAllActiveLinkTags, getAllActiveLinks } from '@/lib/db/links';
import { getSetting } from '@/lib/db/settings';
import { getAllActiveTags, getAllJobTags } from '@/lib/db/tags';

export interface OmniboxSuggestion {
  content: string;
  description: string;
}

interface OmniboxTagRef {
  id: string;
  name: string;
}

export interface OmniboxSearchData {
  envMap: Map<string, string>;
  jobTagsMap: Map<string, OmniboxTagRef[]>;
  jobs: Awaited<ReturnType<typeof getAllJobs>>;
  linkTagsMap: Map<string, OmniboxTagRef[]>;
  links: Awaited<ReturnType<typeof getAllActiveLinks>>;
}

export async function loadOmniboxSearchData(): Promise<OmniboxSearchData> {
  const [allLinks, allLinkTags, allJobTags, allTags, allJobs, environments] = await Promise.all([
    getAllActiveLinks(),
    getAllActiveLinkTags(),
    getAllJobTags(),
    getAllActiveTags(),
    getAllJobs(),
    getSetting('jenkins_environments').then((envs) => envs || []),
  ]);

  const tagsMap = new Map(allTags.map((tag) => [tag.id, tag]));
  const envMap = new Map(environments.map((env) => [env.id, env.name]));

  const linkTagsMap = new Map<string, OmniboxTagRef[]>();
  for (const linkTag of allLinkTags) {
    const tag = tagsMap.get(linkTag.tagId);
    if (!tag) continue;
    const current = linkTagsMap.get(linkTag.linkId) || [];
    current.push({ id: tag.id, name: tag.name });
    linkTagsMap.set(linkTag.linkId, current);
  }

  const jobTagsMap = new Map<string, OmniboxTagRef[]>();
  for (const jobTag of allJobTags) {
    if (jobTag.deletedAt) continue;
    const tag = tagsMap.get(jobTag.tagId);
    if (!tag) continue;
    const current = jobTagsMap.get(jobTag.jobUrl) || [];
    current.push({ id: tag.id, name: tag.name });
    jobTagsMap.set(jobTag.jobUrl, current);
  }

  return {
    envMap,
    jobTagsMap,
    jobs: allJobs,
    linkTagsMap,
    links: allLinks,
  };
}

export function escapeOmniboxXml(value: string): string {
  return value.replace(/[<>&'"]/g, (char) => {
    switch (char) {
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
        return char;
    }
  });
}

export function parseOmniboxTerms(text: string) {
  const terms = text
    .toLowerCase()
    .split(' ')
    .filter((term) => term.trim().length > 0);

  const tagFilters = terms
    .filter((term) => term.startsWith('#') && term.length > 1)
    .map((term) => term.slice(1));
  const keywords = terms.filter((term) => !term.startsWith('#'));

  return { keywords, tagFilters, terms };
}
