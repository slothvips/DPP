import type { MyBuildItem } from '@/db';
import { saveBuilds } from '@/lib/db/jenkins';
import { createJenkinsClient } from './client';
import {
  type JenkinsBuildApiItem,
  type JenkinsJobApiItem,
  createBuildItem,
  resolveBuildOwnership,
} from './fetchMyBuildsShared';

const BUILD_STATUS_TREE =
  'number,url,result,building,timestamp,duration,fullDisplayName,actions[causes[userId,userName]]';

/**
 * Lightweight status fetch for a single build. Used to resolve the final result
 * of a build the moment it leaves the executors, so the history stays current.
 */
export async function getBuildSummary(
  buildUrl: string,
  user: string,
  token: string,
  jenkinsHost: string,
  envId: string
): Promise<MyBuildItem | null> {
  const client = createJenkinsClient({ baseUrl: jenkinsHost, user, token });
  if (!client.isAllowedUrl(buildUrl)) return null;
  const normalizedUrl = buildUrl.replace(/\/$/, '');
  const build = await client.fetchApi<JenkinsBuildApiItem>(normalizedUrl, BUILD_STATUS_TREE);
  if (!build?.url) return null;

  const jobUrl = build.url.replace(/\/\d+\/?$/, '');
  const { builderName } = resolveBuildOwnership(build, user);
  const job: JenkinsJobApiItem = {
    name: build.fullDisplayName || jobUrl,
    url: jobUrl,
    _class: '',
  };
  const item = createBuildItem(job, build, envId, builderName) as MyBuildItem;
  await saveBuilds(envId, [item], []);
  return item;
}
