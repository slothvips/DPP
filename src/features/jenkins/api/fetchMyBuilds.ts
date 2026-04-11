import { type MyBuildItem, type OthersBuildItem } from '@/db';
import { saveBuilds } from '@/lib/db/jenkins';
import { createJenkinsClient } from './client';
import {
  JENKINS_MY_BUILDS_TREE,
  type JenkinsJobApiItem,
  createBuildItem,
  finalizeBuilds,
  resolveBuildOwnership,
} from './fetchMyBuildsShared';
import { traverseJenkinsJobs } from './fetchMyBuildsTraversal';

export async function fetchMyBuilds(
  baseUrl: string,
  user: string,
  token: string,
  envId: string
): Promise<number> {
  const client = createJenkinsClient({ baseUrl, user, token });
  const allMyBuilds: MyBuildItem[] = [];
  const allOthersBuilds: OthersBuildItem[] = [];

  await traverseJenkinsJobs({
    client,
    tree: JENKINS_MY_BUILDS_TREE,
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
  const recentOthersBuilds = uniqueOthersBuilds.slice(0, 50);

  await saveBuilds(envId, uniqueMyBuilds, recentOthersBuilds);

  return uniqueMyBuilds.length;
}
