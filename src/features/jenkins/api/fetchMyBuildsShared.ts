import type { MyBuildItem, OthersBuildItem } from '@/db';

export interface JenkinsBuildApiItem {
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

export interface JenkinsJobApiItem {
  name: string;
  url: string;
  _class: string;
  builds?: JenkinsBuildApiItem[];
  jobs?: JenkinsJobApiItem[];
}

export interface JenkinsJobsResponse {
  jobs?: JenkinsJobApiItem[];
}

export const JENKINS_MY_BUILDS_TREE =
  'jobs[name,url,_class,builds[number,url,result,timestamp,duration,building,fullDisplayName,id,actions[causes[userId,userName]]]{0,20}]';

export function resolveBuildOwnership(build: JenkinsBuildApiItem, user: string) {
  let isMyBuild = false;
  let builderName: string | undefined;

  if (build.actions) {
    for (const action of build.actions) {
      if (!action.causes) {
        continue;
      }

      for (const cause of action.causes) {
        const causeUser = cause.userId || cause.userName;
        if (causeUser === user) {
          isMyBuild = true;
          builderName = causeUser;
          break;
        }
        if (causeUser && !builderName) {
          builderName = causeUser;
        }
      }

      if (isMyBuild) {
        break;
      }
    }
  }

  return { isMyBuild, builderName };
}

export function resolveBuildJobName(job: JenkinsJobApiItem, build: JenkinsBuildApiItem): string {
  if (!build.fullDisplayName) {
    return job.name;
  }

  const parts = build.fullDisplayName.split(' #');
  if (parts.length > 1) {
    return parts.slice(0, -1).join(' #').trim();
  }

  return build.fullDisplayName;
}

export function createBuildItem(
  job: JenkinsJobApiItem,
  build: JenkinsBuildApiItem,
  envId: string,
  builderName?: string
): MyBuildItem | OthersBuildItem {
  return {
    id: build.url,
    number: Number.parseInt(build.number || build.id, 10),
    jobName: resolveBuildJobName(job, build),
    jobUrl: job.url,
    result: build.result || (build.building ? 'Building' : 'Unknown'),
    timestamp: build.timestamp,
    duration: build.duration,
    building: build.building || false,
    userName: builderName,
    env: envId,
  };
}

export function finalizeBuilds<T extends { id: string; timestamp: number }>(builds: T[]): T[] {
  return Array.from(new Map(builds.map((build) => [build.id, build])).values()).sort(
    (left, right) => right.timestamp - left.timestamp
  );
}
