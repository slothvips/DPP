import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { type JobItem, type MyBuildItem, db } from '@/db';
import type { JenkinsQueueItemRecord } from '@/db';
import type { JenkinsFeatureToggles } from '@/features/jenkins/featureFlags';
import { getRecentJenkinsJobs, markRecentJenkinsJob } from '@/features/jenkins/recentJobs';
import { JenkinsService } from '@/features/jenkins/service';
import { type TreeNode } from '@/features/jenkins/utils';
import { getSetting } from '@/lib/db/settings';
import type { BuildJobState } from './jenkinsViewShared';
import { useJenkinsBuildPolling } from './useJenkinsBuildPolling';
import { type JenkinsWorkbenchView, useJenkinsDeepLink } from './useJenkinsDeepLink';
import { useJenkinsViewActions } from './useJenkinsViewActions';
import { useJenkinsViewData } from './useJenkinsViewData';

const JOB_AUTO_REFRESH_MS = 5 * 60_000;
const ACTIVE_QUEUE_STATES = ['queued', 'blocked', 'unknown'];

export type JenkinsJobActivity = 'queued' | 'building';
export type JenkinsJobStatusFilter = 'all' | 'failed' | 'building' | 'success' | 'unbuilt';
export type JenkinsJobSort = 'name' | 'recent' | 'status';

const STATUS_RANK: Record<string, number> = {
  Building: 0,
  FAILURE: 1,
  UNSTABLE: 2,
  SUCCESS: 3,
};

function matchesStatusFilter(
  job: JobItem,
  activity: JenkinsJobActivity | undefined,
  statusFilter: JenkinsJobStatusFilter
): boolean {
  switch (statusFilter) {
    case 'all':
      return true;
    case 'failed':
      return job.lastStatus === 'FAILURE' || job.lastStatus === 'UNSTABLE';
    case 'building':
      return activity === 'building' || job.lastStatus === 'Building';
    case 'success':
      return job.lastStatus === 'SUCCESS';
    case 'unbuilt':
      return !job.lastStatus || job.lastStatus === 'Unknown';
  }
}

function sortJobs(jobs: JobItem[], sortBy: JenkinsJobSort): JobItem[] {
  const sorted = [...jobs];
  if (sortBy === 'recent') {
    return sorted.sort((a, b) => (b.lastBuildTime ?? 0) - (a.lastBuildTime ?? 0));
  }
  if (sortBy === 'status') {
    return sorted.sort((a, b) => {
      const rankDiff =
        (STATUS_RANK[a.lastStatus ?? ''] ?? 4) - (STATUS_RANK[b.lastStatus ?? ''] ?? 4);
      return rankDiff !== 0 ? rankDiff : a.name.localeCompare(b.name);
    });
  }
  return sorted.sort((a, b) => a.name.localeCompare(b.name));
}

function collectFolderUrls(nodes: TreeNode[]): string[] {
  const urls: string[] = [];
  const walk = (list: TreeNode[]) => {
    for (const node of list) {
      if (node.children.length > 0) {
        urls.push(node.job.url);
        walk(node.children);
      }
    }
  };
  walk(nodes);
  return urls;
}

export function useJenkinsView({
  jenkinsFeatureToggles,
  active = true,
}: {
  jenkinsFeatureToggles: JenkinsFeatureToggles;
  active?: boolean;
}) {
  const [activeView, setActiveView] = useState<JenkinsWorkbenchView>('run');
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<JenkinsJobStatusFilter>('all');
  const [tagFilterId, setTagFilterId] = useState('');
  const [sortBy, setSortBy] = useState<JenkinsJobSort>('name');
  const [expandedUrls, setExpandedUrls] = useState<Set<string>>(new Set());
  const [buildJob, setBuildJob] = useState<BuildJobState | null>(null);
  const [detailsJob, setDetailsJob] = useState<JobItem | null>(null);
  const [myBuildsLoading, setMyBuildsLoading] = useState(false);
  const [nextRefreshTime, setNextRefreshTime] = useState<number | null>(null);
  const [shouldCloseOnSuccess, setShouldCloseOnSuccess] = useState(false);
  const [remoteBuilds, setRemoteBuilds] = useState<MyBuildItem[] | null>(null);
  const [buildsStale, setBuildsStale] = useState(false);
  const autoSyncedEnvRef = useRef<string | undefined>(undefined);
  const expandedInitEnvRef = useRef<string | undefined>(undefined);

  const {
    currentEnv,
    currentEnvId,
    displayedBuilds,
    environments,
    jobTagsMap,
    jobTree,
    jobs,
    showOthersBuilds,
    tags,
  } = useJenkinsViewData(active, remoteBuilds);

  const jenkinsHost = currentEnv?.host;
  const jenkinsUser = currentEnv?.user;
  const jenkinsToken = currentEnv?.token;
  const canReachJenkins = Boolean(jenkinsHost && jenkinsUser && jenkinsToken);
  const workbenchEnabled = active && jenkinsFeatureToggles.workbench;

  const recentJobs = useLiveQuery(() => getRecentJenkinsJobs(), [], []);

  const queuedJobs = useLiveQuery(
    () =>
      currentEnvId
        ? db.jenkinsQueueItems
            .where('envId')
            .equals(currentEnvId)
            .filter((item) => ACTIVE_QUEUE_STATES.includes(item.state))
            .toArray()
        : Promise.resolve<JenkinsQueueItemRecord[]>([]),
    [currentEnvId],
    [] as JenkinsQueueItemRecord[]
  );

  const jobActivity = useMemo(() => {
    const map = new Map<string, JenkinsJobActivity>();
    for (const build of remoteBuilds ?? []) {
      if (build.building) map.set(build.jobUrl, 'building');
    }
    for (const item of queuedJobs) {
      if (item.jobUrl && !map.has(item.jobUrl)) map.set(item.jobUrl, 'queued');
    }
    return map;
  }, [remoteBuilds, queuedJobs]);

  const hasActiveFilter = filter.trim() !== '' || statusFilter !== 'all' || tagFilterId !== '';

  const filteredJobs = useMemo(() => {
    const keywords = filter.toLowerCase().split(' ').filter(Boolean);
    const matched = jobs.filter((job) => {
      if (
        statusFilter !== 'all' &&
        !matchesStatusFilter(job, jobActivity.get(job.url), statusFilter)
      ) {
        return false;
      }
      if (tagFilterId) {
        const tagIds = (jobTagsMap.get(job.url) || []).map((tag) => tag.id);
        if (!tagIds.includes(tagFilterId)) return false;
      }
      if (keywords.length > 0) {
        const name = job.name.toLowerCase();
        const fullName = (job.fullName || job.name).toLowerCase();
        const tagNames = (jobTagsMap.get(job.url) || []).map((tag) => tag.name.toLowerCase());
        if (
          !keywords.every(
            (keyword) =>
              name.includes(keyword) ||
              fullName.includes(keyword) ||
              tagNames.some((tagName) => tagName.includes(keyword))
          )
        ) {
          return false;
        }
      }
      return true;
    });
    return sortJobs(matched, sortBy);
  }, [filter, jobActivity, jobTagsMap, jobs, sortBy, statusFilter, tagFilterId]);

  useEffect(() => {
    setNextRefreshTime(null);
    setRemoteBuilds(null);
    setBuildsStale(false);
    setDetailsJob(null);
  }, [currentEnvId]);

  // Load jobs automatically on first activation instead of forcing a manual 采集.
  useEffect(() => {
    if (!workbenchEnabled || !canReachJenkins || !currentEnvId) return;
    if (autoSyncedEnvRef.current === currentEnvId) return;
    autoSyncedEnvRef.current = currentEnvId;
    void (async () => {
      try {
        const refreshMap = (await getSetting('jenkins_jobs_last_refresh_by_env')) || {};
        const last = refreshMap[currentEnvId] ?? 0;
        if (Date.now() - last < JOB_AUTO_REFRESH_MS) return;
        setLoading(true);
        await JenkinsService.fetchAllJobs();
      } catch {
        // The manual 采集 button surfaces errors; auto-refresh stays silent.
      } finally {
        setLoading(false);
      }
    })();
  }, [canReachJenkins, currentEnvId, workbenchEnabled]);

  // Expand root-level folders once the tree first arrives for an environment.
  useEffect(() => {
    if (!currentEnvId || jobTree.length === 0) return;
    if (expandedInitEnvRef.current === currentEnvId) return;
    const rootFolders = jobTree
      .filter((node) => node.children.length > 0)
      .map((node) => node.job.url);
    if (rootFolders.length === 0) return;
    expandedInitEnvRef.current = currentEnvId;
    setExpandedUrls(new Set(rootFolders));
  }, [currentEnvId, jobTree]);

  useEffect(() => {
    if (!jenkinsFeatureToggles.queue && activeView === 'queue') setActiveView('run');
  }, [activeView, jenkinsFeatureToggles.queue]);

  useJenkinsDeepLink({
    currentEnvId,
    environments,
    onBuildJobChange: setBuildJob,
    onShouldCloseOnSuccessChange: setShouldCloseOnSuccess,
    onViewChange: setActiveView,
  });

  const { refresh: refreshBuilds } = useJenkinsBuildPolling({
    enabled: Boolean(workbenchEnabled && canReachJenkins),
    envId: currentEnvId,
    onBuildsChange: setRemoteBuilds,
    onRemoteError: setBuildsStale,
    onLoadingChange: setMyBuildsLoading,
    onNextRefreshTimeChange: setNextRefreshTime,
  });

  const {
    closeBuildDialog,
    handleBuildSuccess,
    handleCancelBuild,
    handleEnvChange,
    handleSync,
    handleToggleShowOthers,
    openBuildDialog,
    toggleExpand,
  } = useJenkinsViewActions({
    environments,
    expandedUrls,
    jenkinsHost,
    jenkinsToken,
    jenkinsUser,
    jenkinsFeatureToggles,
    shouldCloseOnSuccess,
    onBuildJobChange: setBuildJob,
    onExpandedUrlsChange: setExpandedUrls,
    onLoadingChange: setLoading,
  });

  const markJobUsed = (job: JobItem) => {
    void markRecentJenkinsJob({ envId: job.env, url: job.url, name: job.name });
  };

  const openJobDetails = (job: JobItem) => {
    markJobUsed(job);
    setDetailsJob(job);
  };

  const openBuildDialogTracked = (job: BuildJobState) => {
    void markRecentJenkinsJob({ envId: job.envId, url: job.url, name: job.name });
    openBuildDialog(job);
  };

  const expandAll = () => setExpandedUrls(new Set(collectFolderUrls(jobTree)));
  const collapseAll = () => setExpandedUrls(new Set());

  return {
    activeView,
    buildJob,
    buildsStale,
    collapseAll,
    currentEnvId,
    detailsJob,
    displayedBuilds,
    environments,
    expandAll,
    expandedUrls,
    filter,
    filteredJobs,
    handleBuildSuccess,
    handleCancelBuild,
    handleEnvChange,
    handleSync,
    handleToggleShowOthers,
    hasActiveFilter,
    jobActivity,
    jobTagsMap,
    jobTree,
    jobs,
    loading,
    myBuildsLoading,
    nextRefreshTime,
    openBuildDialog: openBuildDialogTracked,
    closeBuildDialog,
    openJobDetails,
    closeJobDetails: () => setDetailsJob(null),
    recentJobs,
    refreshBuilds,
    setFilter,
    setStatusFilter,
    setTagFilterId,
    setSortBy,
    setActiveView,
    showOthersBuilds,
    sortBy,
    statusFilter,
    tagFilterId,
    tags,
    toggleExpand,
  };
}
