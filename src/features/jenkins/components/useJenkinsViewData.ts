import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import {
  type JenkinsBuildRecord,
  type JenkinsEnvironment,
  type MyBuildItem,
  type TagItem,
  db,
} from '@/db';
import { buildJobTree, deriveJobNameFromUrl } from '@/features/jenkins/utils';

const EMPTY_SETTINGS = {
  currentEnvId: undefined,
  environments: [],
  showOthersBuilds: false,
} satisfies {
  currentEnvId: string | undefined;
  environments: JenkinsEnvironment[];
  showOthersBuilds: boolean;
};

function toMyBuildItem(record: JenkinsBuildRecord, envId: string | undefined): MyBuildItem {
  return {
    id: record.id,
    number: record.number,
    jobName: record.jobName || deriveJobNameFromUrl(record.jobUrl),
    jobUrl: record.jobUrl,
    result: record.result || (record.building ? 'Building' : 'Unknown'),
    timestamp: record.timestamp,
    duration: record.duration,
    building: record.building,
    userName: record.owner,
    env: envId ?? record.envId,
  };
}

export function useJenkinsViewData(active = true, remoteBuilds: MyBuildItem[] | null = null) {
  const settings = useLiveQuery(
    async () => {
      const [currentEnvSetting, environmentsSetting, showOthersBuildsSetting] = await Promise.all([
        db.settings.get('jenkins_current_env'),
        db.settings.get('jenkins_environments'),
        db.settings.get('show_others_builds'),
      ]);

      return {
        currentEnvId: currentEnvSetting?.value as string | undefined,
        environments: (environmentsSetting?.value as JenkinsEnvironment[] | undefined) || [],
        showOthersBuilds: (showOthersBuildsSetting?.value as boolean | undefined) ?? false,
      };
    },
    [],
    EMPTY_SETTINGS
  );

  const { currentEnvId, environments, showOthersBuilds } = settings;
  const currentEnv = environments.find((environment) => environment.id === currentEnvId);

  const { jobs, jobTags, tags, fallbackBuilds } = useLiveQuery(
    async () => {
      if (!currentEnvId || !active) {
        return { jobs: [], jobTags: [], tags: [], fallbackBuilds: [] };
      }

      const [scopedJobs, allJobTags, allTags, scopedBuilds] = await Promise.all([
        db.jenkinsJobs.where('envId').equals(currentEnvId).toArray(),
        db.jobTags.filter((jobTag) => !jobTag.deletedAt).toArray(),
        db.tags.filter((tag) => !tag.deletedAt).toArray(),
        db.jenkinsBuilds.where('envId').equals(currentEnvId).toArray(),
      ]);

      return {
        jobs: scopedJobs.sort((a, b) => a.name.localeCompare(b.name)),
        jobTags: allJobTags,
        tags: allTags,
        fallbackBuilds: scopedBuilds,
      };
    },
    [currentEnvId, active],
    { jobs: [], jobTags: [], tags: [], fallbackBuilds: [] }
  );

  const builds = useMemo<MyBuildItem[]>(() => {
    if (Array.isArray(remoteBuilds)) return remoteBuilds;
    if (!Array.isArray(fallbackBuilds)) return [];
    return fallbackBuilds.map((record) => toMyBuildItem(record, currentEnvId));
  }, [remoteBuilds, fallbackBuilds, currentEnvId]);

  const currentUserName = currentEnv?.user;
  const myBuilds = useMemo(() => {
    const mine = currentUserName
      ? builds.filter((build) => build.userName === currentUserName)
      : builds;
    return [...mine].sort((a, b) => b.timestamp - a.timestamp);
  }, [builds, currentUserName]);

  const othersBuilds = useMemo(() => {
    if (!currentUserName) return [];
    return builds
      .filter((build) => build.userName !== currentUserName)
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [builds, currentUserName]);

  const displayedBuilds = useMemo(() => {
    if (showOthersBuilds) {
      return [...myBuilds, ...othersBuilds].sort((a, b) => b.timestamp - a.timestamp);
    }
    return myBuilds;
  }, [myBuilds, othersBuilds, showOthersBuilds]);

  const tagsById = useMemo(() => new Map(tags.map((tag) => [tag.id, tag])), [tags]);

  const jobTagsMap = useMemo(() => {
    const map = new Map<string, TagItem[]>();
    for (const jobTag of jobTags) {
      const tag = tagsById.get(jobTag.tagId);
      if (!tag) continue;
      const existing = map.get(jobTag.jobUrl);
      if (existing) {
        existing.push(tag);
      } else {
        map.set(jobTag.jobUrl, [tag]);
      }
    }
    return map;
  }, [jobTags, tagsById]);

  const jobTree = useMemo(() => {
    if (jobs.length === 0) return [];
    return buildJobTree(jobs);
  }, [jobs]);

  return {
    currentEnv,
    currentEnvId,
    displayedBuilds,
    environments,
    jobTagsMap,
    jobTree,
    jobs,
    showOthersBuilds,
    tags,
  };
}
