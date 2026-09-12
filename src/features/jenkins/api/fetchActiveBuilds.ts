import type { MyBuildItem, OthersBuildItem } from '@/db';
import { saveBuilds } from '@/lib/db/jenkins';
import { logger } from '@/utils/logger';
import { createJenkinsClient } from './client';
import {
  type JenkinsBuildApiItem,
  type JenkinsJobApiItem,
  createBuildItem,
  resolveBuildOwnership,
} from './fetchMyBuildsShared';

interface JenkinsComputerResponse {
  computer?: Array<{
    executors?: Array<{ currentExecutable?: { url?: string } }>;
  }>;
}

const ACTIVE_EXECUTORS_TREE = 'computer[executors[currentExecutable[url]]]';
const ACTIVE_BUILD_TREE =
  'number,url,result,building,timestamp,duration,fullDisplayName,actions[causes[userId,userName]]';
const MAX_ACTIVE_BUILDS = 20;

/**
 * Polls only currently running builds: one request to the executors to discover
 * their URLs, then one request per active build. Finished builds are picked up
 * by the periodic full refresh.
 */
export async function fetchActiveBuilds(
  baseUrl: string,
  user: string,
  token: string,
  envId: string
): Promise<MyBuildItem[]> {
  const client = createJenkinsClient({ baseUrl, user, token });
  const computer = await client.fetchApi<JenkinsComputerResponse>(
    `${client.rootUrl}/computer`,
    ACTIVE_EXECUTORS_TREE
  );

  const buildUrls = new Set<string>();
  for (const node of computer?.computer ?? []) {
    for (const executor of node.executors ?? []) {
      const url = executor.currentExecutable?.url;
      if (url && client.isAllowedUrl(url)) {
        buildUrls.add(url.replace(/\/$/, ''));
      }
    }
  }
  if (buildUrls.size === 0) return [];

  const myBuilds: MyBuildItem[] = [];
  const othersBuilds: OthersBuildItem[] = [];

  const activeBuilds = await Promise.all(
    [...buildUrls].slice(0, MAX_ACTIVE_BUILDS).map(async (buildUrl) => {
      try {
        return await client.fetchApi<JenkinsBuildApiItem>(buildUrl, ACTIVE_BUILD_TREE);
      } catch (error) {
        logger.warn('Failed to read an active Jenkins build', error);
        return null;
      }
    })
  );

  for (const build of activeBuilds) {
    if (!build?.url || !client.isAllowedUrl(build.url)) continue;

    const jobUrl = build.url.replace(/\/\d+\/?$/, '');
    const { isMyBuild, builderName } = resolveBuildOwnership(build, user);
    const job: JenkinsJobApiItem = {
      name: build.fullDisplayName || jobUrl,
      url: jobUrl,
      _class: '',
    };
    const item = createBuildItem(job, build, envId, builderName);

    if (isMyBuild) {
      myBuilds.push(item as MyBuildItem);
    } else {
      othersBuilds.push(item as OthersBuildItem);
    }
  }

  if (myBuilds.length > 0 || othersBuilds.length > 0) {
    await saveBuilds(envId, myBuilds, othersBuilds);
  }

  return [...myBuilds, ...othersBuilds];
}
