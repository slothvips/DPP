import { logger } from '@/utils/logger';
import type { JenkinsClient } from './client';
import type { JenkinsJobApiItem, JenkinsJobsResponse } from './fetchMyBuildsShared';

interface TraverseJenkinsJobsOptions {
  client: JenkinsClient;
  tree: string;
  maxDepth?: number;
  onJob: (job: JenkinsJobApiItem) => void | Promise<void>;
}

export async function traverseJenkinsJobs({
  client,
  tree,
  maxDepth = 10,
  onJob,
}: TraverseJenkinsJobsOptions) {
  const processedUrls = new Set<string>();

  async function traverse(url: string, depth = 0): Promise<void> {
    if (depth >= maxDepth) {
      logger.warn(`[Jenkins] Max depth ${maxDepth} reached at ${url}. Skipping deeper traversal.`);
      return;
    }

    const normalizedUrl = url.replace(/\/$/, '');
    if (processedUrls.has(normalizedUrl)) {
      return;
    }
    processedUrls.add(normalizedUrl);

    const data = await client.fetchApi<JenkinsJobsResponse>(url, tree);
    if (!data?.jobs) {
      return;
    }

    const folders: string[] = [];

    for (const job of data.jobs) {
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
