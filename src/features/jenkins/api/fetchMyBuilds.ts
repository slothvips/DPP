import { type MyBuildItem, type OthersBuildItem } from '@/db';
import { recordJenkinsCache } from '@/features/jenkins/metrics';
import {
  MAX_OTHERS_BUILDS_PER_ENV,
  pruneJenkinsBuilds,
  saveBuilds,
  trackJenkinsSync,
  updateJenkinsRefreshTime,
} from '@/lib/db/jenkins';
import { createJenkinsClient } from './client';
import {
  DEFAULT_BUILDS_PER_JOB,
  type JenkinsJobApiItem,
  buildMyBuildsTree,
  createBuildItem,
  finalizeBuilds,
  resolveBuildOwnership,
} from './fetchMyBuildsShared';
import { traverseJenkinsJobs } from './fetchMyBuildsTraversal';

export async function fetchMyBuilds(
  baseUrl: string,
  user: string,
  token: string,
  envId: string,
  maxBuildsPerJob = DEFAULT_BUILDS_PER_JOB
): Promise<MyBuildItem[]> {
  return trackJenkinsSync(envId, () =>
    fetchMyBuildsInternal(baseUrl, user, token, envId, maxBuildsPerJob)
  );
}

async function fetchMyBuildsInternal(
  baseUrl: string,
  user: string,
  token: string,
  envId: string,
  maxBuildsPerJob: number
): Promise<MyBuildItem[]> {
  const client = createJenkinsClient({ baseUrl, user, token });
  const allMyBuilds: MyBuildItem[] = [];
  const allOthersBuilds: OthersBuildItem[] = [];

  await traverseJenkinsJobs({
    client,
    tree: buildMyBuildsTree(maxBuildsPerJob),
    onJob: async (job: JenkinsJobApiItem) => {
      if (!job.builds?.length) {
        return;
      }

      for (const build of job.builds) {
        const { isMyBuild, builderName } = resolveBuildOwnership(build, user);
        const buildItem = createBuildItem(job, build, envId, builderName);

        if (isMyBuild) {
          allMyBuilds.push(buildItem as MyBuildItem);
        } else if (builderName) {
          allOthersBuilds.push(buildItem as OthersBuildItem);
        }
      }
    },
  });

  const uniqueMyBuilds = finalizeBuilds(allMyBuilds);
  const uniqueOthersBuilds = finalizeBuilds(allOthersBuilds);
  const recentOthersBuilds = uniqueOthersBuilds.slice(0, MAX_OTHERS_BUILDS_PER_ENV);

  await saveBuilds(envId, uniqueMyBuilds, recentOthersBuilds);
  await pruneJenkinsBuilds(envId);
  recordJenkinsCache('builds', uniqueMyBuilds.length + recentOthersBuilds.length);
  await updateJenkinsRefreshTime('jenkins_builds_last_refresh_by_env', envId);

  return finalizeBuilds([...uniqueMyBuilds, ...recentOthersBuilds]);
}
