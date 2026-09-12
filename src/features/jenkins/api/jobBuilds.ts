import type { JenkinsJobBuildsResult } from '@/features/jenkins/messages';
import { createJenkinsClient } from './client';
import { resolveBuildOwnership } from './fetchMyBuildsShared';

interface JenkinsJobBuildApiItem {
  number?: number;
  url?: string;
  result?: string;
  timestamp?: number;
  duration?: number;
  building?: boolean;
  actions?: Array<{ causes?: Array<{ userId?: string; userName?: string }> }>;
}

interface JenkinsJobBuildsResponse {
  name?: string;
  fullName?: string;
  url?: string;
  builds?: JenkinsJobBuildApiItem[];
}

const MAX_JOB_BUILDS = 100;
const DEFAULT_JOB_BUILDS = 20;

/**
 * Reads a single Job's build history straight from Jenkins. This is the official
 * per-job `builds[...]` endpoint, used instead of the local build cache.
 */
export async function getJobBuilds(
  jobUrl: string,
  user: string,
  token: string,
  jenkinsHost: string,
  limit = DEFAULT_JOB_BUILDS
): Promise<JenkinsJobBuildsResult> {
  const client = createJenkinsClient({ baseUrl: jenkinsHost, user, token });
  const rootUrl = client.isAllowedUrl(jobUrl) ? jobUrl.replace(/\/$/, '') : '';
  if (!rootUrl) throw new Error('Jenkins Job 地址无效');

  const count = Math.min(Math.max(1, Math.floor(limit)), MAX_JOB_BUILDS);
  const tree = `name,fullName,url,builds[number,url,result,timestamp,duration,building,actions[causes[userId,userName]]]{0,${count}}`;
  const data = await client.fetchApi<JenkinsJobBuildsResponse>(rootUrl, tree);
  if (!data) throw new Error('Jenkins Job 返回为空');

  const builds = (data.builds || [])
    .filter((build) => build.url && client.isAllowedUrl(build.url))
    .map((build) => {
      const { builderName } = resolveBuildOwnership(
        {
          id: String(build.number ?? ''),
          number: String(build.number ?? ''),
          url: build.url as string,
          result: build.result,
          timestamp: build.timestamp ?? 0,
          duration: build.duration,
          building: build.building ?? false,
          actions: build.actions,
        },
        user
      );
      const lastStatus = build.building ? 'Building' : build.result;
      return {
        id: build.url as string,
        number: build.number ?? 0,
        result: build.result,
        timestamp: build.timestamp ?? 0,
        duration: build.duration ?? 0,
        building: build.building ?? false,
        userName: builderName,
        lastStatus,
      };
    });

  return {
    job: {
      name: data.fullName || data.name || rootUrl,
      url: rootUrl,
      lastStatus: builds[0]?.lastStatus,
    },
    builds,
    total: builds.length,
  };
}
