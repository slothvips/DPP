import { type MyBuildItem, db } from '@/db';
import { logger } from '@/utils/logger';
import { createJenkinsClient } from './client';

interface JenkinsBuildApiItem {
  id: string;
  number: string;
  url: string;
  result?: string;
  timestamp: number;
  duration?: number;
  building: boolean;
  fullDisplayName?: string;
  actions?: Array<{
    causes?: Array<{
      userId?: string;
      userName?: string;
    }>;
  }>;
}

interface JenkinsJobApiItem {
  name: string;
  url: string;
  _class: string;
  builds?: JenkinsBuildApiItem[];
  jobs?: JenkinsJobApiItem[];
}

interface JenkinsJobsResponse {
  jobs?: JenkinsJobApiItem[];
}

export async function fetchMyBuilds(baseUrl: string, user: string, token: string): Promise<number> {
  const client = createJenkinsClient({ baseUrl, user, token });
  const allMyBuilds: MyBuildItem[] = [];
  const processedUrls = new Set<string>();
  const MAX_DEPTH = 10; // Maximum folder depth to prevent infinite recursion

  const tree =
    'jobs[name,url,_class,builds[number,url,result,timestamp,duration,building,fullDisplayName,id,actions[causes[userId,userName]]]{0,20}]';

  async function traverse(url: string, depth = 0) {
    // Depth limit check
    if (depth >= MAX_DEPTH) {
      logger.warn(`[Jenkins] Max depth ${MAX_DEPTH} reached at ${url}. Skipping deeper traversal.`);
      return;
    }

    // Normalize URL to prevent duplicate processing
    const normalizedUrl = url.replace(/\/$/, '');
    if (processedUrls.has(normalizedUrl)) {
      return;
    }
    processedUrls.add(normalizedUrl);

    const data = await client.fetchApi<JenkinsJobsResponse>(url, tree);
    if (!data?.jobs) return;

    const folders: string[] = [];

    for (const j of data.jobs) {
      if (j.builds && j.builds.length > 0) {
        for (const b of j.builds) {
          let isMyBuild = false;

          if (b.actions) {
            for (const action of b.actions) {
              if (action.causes) {
                for (const cause of action.causes) {
                  if (cause.userId === user || cause.userName === user) {
                    isMyBuild = true;
                    break;
                  }
                }
              }
              if (isMyBuild) break;
            }
          }

          if (isMyBuild) {
            let displayJobName = 'Unknown';
            if (b.fullDisplayName) {
              const parts = b.fullDisplayName.split(' #');
              if (parts.length > 1) {
                displayJobName = parts.slice(0, -1).join(' #').trim();
              } else {
                displayJobName = b.fullDisplayName;
              }
            } else {
              displayJobName = j.name;
            }

            allMyBuilds.push({
              id: b.url,
              number: Number.parseInt(b.number || b.id, 10),
              jobName: displayJobName,
              jobUrl: j.url,
              result: b.result || (b.building ? 'Building' : 'Unknown'),
              timestamp: b.timestamp,
              duration: b.duration,
              building: b.building || false,
            });
          }
        }
      }

      if (client.isFolder(j._class)) {
        folders.push(j.url);
      }
    }

    for (const folderUrl of folders) {
      await traverse(folderUrl, depth + 1);
    }
  }

  await traverse(client.rootUrl);

  const uniqueBuilds = Array.from(new Map(allMyBuilds.map((b) => [b.id, b])).values());
  uniqueBuilds.sort((a, b) => b.timestamp - a.timestamp);

  await db.transaction('rw', db.myBuilds, async () => {
    await db.myBuilds.clear();
    await db.myBuilds.bulkPut(uniqueBuilds);
  });

  return uniqueBuilds.length;
}
