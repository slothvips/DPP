import { type JobItem } from '@/db';
import { saveJobs, updateJenkinsRefreshTime } from '@/lib/db/jenkins';
import { logger } from '@/utils/logger';
import { createJenkinsClient } from './client';

interface JenkinsJobsResponse {
  jobs?: Array<{
    name: string;
    url: string;
    color?: string;
    fullName?: string;
    _class?: string;
    lastBuild?: {
      number?: number;
      url?: string;
      result?: string;
      timestamp?: number;
      building?: boolean;
      actions?: Array<{
        causes?: Array<{
          userId?: string;
          userName?: string;
        }>;
      }>;
    };
  }>;
}

export async function fetchAllJobs(
  baseUrl: string,
  user: string,
  token: string,
  envId: string
): Promise<number> {
  const client = createJenkinsClient({ baseUrl, user, token });
  const jobs: JobItem[] = [];
  const MAX_DEPTH = 10; // Maximum folder depth to prevent infinite recursion
  const MAX_NODES = 5000;
  const processedUrls = new Set<string>();

  const tree =
    'jobs[name,url,color,fullName,_class,lastBuild[number,url,result,timestamp,building,actions[causes[userId,userName]]]]';

  async function traverse(url: string, depth = 0) {
    // Depth limit check
    if (depth >= MAX_DEPTH) {
      logger.warn(`[Jenkins] Max depth ${MAX_DEPTH} reached at ${url}. Skipping deeper traversal.`);
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
    if (processedUrls.size >= MAX_NODES) {
      logger.warn(`[Jenkins] Max node count ${MAX_NODES} reached. Stopping traversal.`);
      return;
    }
    processedUrls.add(normalizedUrl);

    const data = await client.fetchApi<JenkinsJobsResponse>(url, tree);
    if (!data?.jobs) return;

    const folders: string[] = [];

    for (const j of data.jobs) {
      if (
        !client.isAllowedUrl(j.url) ||
        (j.lastBuild?.url && !client.isAllowedUrl(j.lastBuild.url))
      ) {
        logger.warn('[Jenkins] Ignoring job with a cross-origin URL');
        continue;
      }
      let status: JobItem['lastStatus'] = 'Unknown';
      let buildUser: string | undefined;

      if (j.lastBuild) {
        if (j.lastBuild.building) {
          status = 'Building';
        } else if (j.lastBuild.result) {
          status = j.lastBuild.result as JobItem['lastStatus'];
        }

        if (j.lastBuild.actions) {
          for (const action of j.lastBuild.actions) {
            if (action.causes) {
              for (const cause of action.causes) {
                if (cause.userId) {
                  buildUser = cause.userId;
                  break;
                }
                if (cause.userName) {
                  buildUser = cause.userName;
                }
              }
            }
            if (buildUser) break;
          }
        }
      }

      jobs.push({
        url: j.url,
        name: j.name,
        fullName: j.fullName || j.name,
        color: j.color,
        type: j._class,
        lastStatus: status,
        lastBuildUrl: j.lastBuild?.url,
        lastBuildTime: j.lastBuild?.timestamp,
        lastBuildUser: buildUser,
        env: envId,
      });

      if (client.isFolder(j._class)) {
        folders.push(j.url);
      }
    }

    for (const folderUrl of folders) {
      await traverse(folderUrl, depth + 1);
    }
  }

  await traverse(client.rootUrl);

  await saveJobs(jobs);
  await updateJenkinsRefreshTime('jenkins_jobs_last_refresh_by_env', envId);

  return jobs.length;
}
