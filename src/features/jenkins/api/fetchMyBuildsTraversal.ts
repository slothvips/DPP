import { logger } from '@/utils/logger';
import type { JenkinsClient } from './client';
import type { JenkinsJobApiItem, JenkinsJobsResponse } from './fetchMyBuildsShared';

interface TraverseJenkinsJobsOptions {
  client: JenkinsClient;
  tree: string;
  maxDepth?: number;
  maxNodes?: number;
  onJob: (job: JenkinsJobApiItem) => void | Promise<void>;
}

export async function traverseJenkinsJobs({
  client,
  tree,
  maxDepth = 10,
  maxNodes = 5000,
  onJob,
}: TraverseJenkinsJobsOptions) {
  const processedUrls = new Set<string>();

  async function traverse(url: string, depth = 0): Promise<void> {
    if (depth >= maxDepth) {
      logger.warn(`[Jenkins] Max depth ${maxDepth} reached at ${url}. Skipping deeper traversal.`);
      return;
    }

    if (!client.isAllowedUrl(url)) {
      logger.warn('[Jenkins] Ignoring cross-origin job URL');
      return;
    }

    const normalizedUrl = url.replace(/\/$/, '');
    if (processedUrls.has(normalizedUrl)) {
      return;
    }
    if (processedUrls.size >= maxNodes) {
      logger.warn(`[Jenkins] Max node count ${maxNodes} reached. Stopping traversal.`);
      return;
    }
    processedUrls.add(normalizedUrl);

    const data = await client.fetchApi<JenkinsJobsResponse>(url, tree);
    if (!data?.jobs) {
      return;
    }

    const folders: string[] = [];

    for (const job of data.jobs) {
      if (
        !client.isAllowedUrl(job.url) ||
        job.builds?.some((build) => !client.isAllowedUrl(build.url))
      ) {
        logger.warn('[Jenkins] Ignoring job with a cross-origin URL');
        continue;
      }
      await onJob(job);
      if (client.isFolder(job._class)) {
        folders.push(job.url);
      }
    }

    for (const folderUrl of folders) {
      await traverse(folderUrl, depth + 1);
    }
  }

  await traverse(client.rootUrl);
}
