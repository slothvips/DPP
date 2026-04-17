import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { type JenkinsEnvironment, db } from '@/db';
import { buildJobTree } from '@/features/jenkins/utils';

export function useJenkinsViewData(filter: string) {
  const settings = useLiveQuery(() => db.settings.toArray(), [], []);
  const settingsMap = useMemo(
    () => new Map(settings.map((setting) => [setting.key, setting.value])),
    [settings]
  );

  const currentEnvId = settingsMap.get('jenkins_current_env') as string | undefined;
  const environments =
    (settingsMap.get('jenkins_environments') as JenkinsEnvironment[] | undefined) || [];
  const currentEnv = environments.find((environment) => environment.id === currentEnvId);
  const showOthersBuilds = (settingsMap.get('show_others_builds') as boolean | undefined) ?? false;
  const lastBuildsRefreshByEnv =
    (settingsMap.get('jenkins_builds_last_refresh_by_env') as Record<string, number> | undefined) ||
    {};
  const lastJobsRefreshByEnv =
    (settingsMap.get('jenkins_jobs_last_refresh_by_env') as Record<string, number> | undefined) ||
    {};
  const lastBuildsRefreshTime = currentEnvId
    ? (lastBuildsRefreshByEnv[currentEnvId] ?? null)
    : null;
  const lastJobsRefreshTime = currentEnvId ? (lastJobsRefreshByEnv[currentEnvId] ?? null) : null;

  const { jobs, jobTags, tags, myBuilds, othersBuilds } = useLiveQuery(
    async () => {
      if (!currentEnvId) {
        return { jobs: [], jobTags: [], tags: [], myBuilds: [], othersBuilds: [] };
      }

      const [allJobs, allJobTags, allTags, allMyBuilds, allOthersBuilds] = await Promise.all([
        db.jobs.where('env').equals(currentEnvId).toArray(),
        db.jobTags.filter((jobTag) => !jobTag.deletedAt).toArray(),
        db.tags.filter((tag) => !tag.deletedAt).toArray(),
        db.myBuilds.where('env').equals(currentEnvId).reverse().sortBy('timestamp'),
        db.othersBuilds.where('env').equals(currentEnvId).reverse().sortBy('timestamp'),
      ]);

      return {
        jobs: allJobs.sort((a, b) => a.name.localeCompare(b.name)),
        jobTags: allJobTags,
        tags: allTags,
        myBuilds: allMyBuilds,
        othersBuilds: allOthersBuilds,
      };
    },
    [currentEnvId],
    { jobs: [], jobTags: [], tags: [], myBuilds: [], othersBuilds: [] }
  );

  const displayedBuilds = useMemo(() => {
    const builds = showOthersBuilds ? [...myBuilds, ...othersBuilds] : [...myBuilds];
    return builds.sort((a, b) => b.timestamp - a.timestamp);
  }, [myBuilds, othersBuilds, showOthersBuilds]);

  const tagsById = useMemo(() => new Map(tags.map((tag) => [tag.id, tag])), [tags]);

  const jobTagsMap = useMemo(() => {
    const map = new Map<string, typeof tags>();
    for (const jobTag of jobTags) {
      const tag = tagsById.get(jobTag.tagId);
      if (!tag) continue;
      map.set(jobTag.jobUrl, [...(map.get(jobTag.jobUrl) || []), tag]);
    }
    return map;
  }, [jobTags, tagsById]);

  const filteredJobs = useMemo(() => {
    if (jobs.length === 0 || !filter) return jobs;

    const keywords = filter.toLowerCase().split(' ').filter(Boolean);
    if (keywords.length === 0) return jobs;

    return jobs.filter((job) => {
      const name = job.name.toLowerCase();
      const fullName = (job.fullName || job.name).toLowerCase();
      const jobTagNames = (jobTagsMap.get(job.url) || []).map((tag) => tag.name.toLowerCase());

      return keywords.every(
        (keyword) =>
          name.includes(keyword) ||
          fullName.includes(keyword) ||
          jobTagNames.some((tagName) => tagName?.includes(keyword))
      );
    });
  }, [filter, jobTagsMap, jobs]);

  const jobTree = useMemo(() => {
    if (filter || jobs.length === 0) return [];
    return buildJobTree(jobs);
  }, [filter, jobs]);

  return {
    currentEnv,
    currentEnvId,
    displayedBuilds,
    environments,
    filteredJobs,
    jobTagsMap,
    jobTree,
    jobs,
    lastBuildsRefreshTime,
    lastJobsRefreshTime,
    showOthersBuilds,
    tags,
  };
}
