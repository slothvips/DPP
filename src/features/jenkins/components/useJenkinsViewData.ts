import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { type JenkinsEnvironment, db } from '@/db';
import { buildJobTree } from '@/features/jenkins/utils';

export function useJenkinsViewData(filter: string, refreshKey: number) {
  const settings = useLiveQuery(() => db.settings.toArray(), [], []);
  const currentEnvId = settings.find((setting) => setting.key === 'jenkins_current_env')?.value as
    | string
    | undefined;

  const environments = useMemo(
    () =>
      (settings.find((setting) => setting.key === 'jenkins_environments')
        ?.value as JenkinsEnvironment[]) || [],
    [settings]
  );
  const currentEnv = environments.find((environment) => environment.id === currentEnvId);
  const showOthersBuilds =
    (settings.find((setting) => setting.key === 'show_others_builds')?.value as boolean) ?? false;

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
    [refreshKey, currentEnvId],
    { jobs: [], jobTags: [], tags: [], myBuilds: [], othersBuilds: [] }
  );

  const displayedBuilds = useMemo(() => {
    const builds = showOthersBuilds ? [...myBuilds, ...othersBuilds] : [...myBuilds];
    return builds.sort((a, b) => b.timestamp - a.timestamp);
  }, [myBuilds, othersBuilds, showOthersBuilds]);

  const jobTagsMap = useMemo(() => {
    const map = new Map<string, typeof tags>();
    for (const jobTag of jobTags) {
      const tag = tags.find((currentTag) => currentTag.id === jobTag.tagId);
      if (!tag) continue;
      map.set(jobTag.jobUrl, [...(map.get(jobTag.jobUrl) || []), tag]);
    }
    return map;
  }, [jobTags, tags]);

  const filteredJobs = useMemo(() => {
    if (jobs.length === 0 || !filter) return jobs;

    const keywords = filter.toLowerCase().split(' ').filter(Boolean);
    if (keywords.length === 0) return jobs;

    return jobs.filter((job) => {
      const name = job.name.toLowerCase();
      const fullName = (job.fullName || job.name).toLowerCase();
      const jobTagNames = jobTags
        .filter((jobTag) => jobTag.jobUrl === job.url)
        .map((jobTag) => tags.find((tag) => tag.id === jobTag.tagId)?.name.toLowerCase())
        .filter(Boolean);

      return keywords.every(
        (keyword) =>
          name.includes(keyword) ||
          fullName.includes(keyword) ||
          jobTagNames.some((tagName) => tagName?.includes(keyword))
      );
    });
  }, [filter, jobTags, jobs, tags]);

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
    showOthersBuilds,
    tags,
  };
}
