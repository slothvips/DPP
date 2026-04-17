import { useEffect, useState } from 'react';
import { logger } from '@/utils/logger';
import type { BuildJobState } from './jenkinsViewShared';
import { useJenkinsBuildPolling } from './useJenkinsBuildPolling';
import { useJenkinsDeepLink } from './useJenkinsDeepLink';
import { useJenkinsViewActions } from './useJenkinsViewActions';
import { useJenkinsViewData } from './useJenkinsViewData';

export function useJenkinsView() {
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');
  const [expandedUrls, setExpandedUrls] = useState<Set<string>>(new Set());
  const [buildJob, setBuildJob] = useState<BuildJobState | null>(null);
  const [myBuildsLoading, setMyBuildsLoading] = useState(false);
  const [nextRefreshTime, setNextRefreshTime] = useState<number | null>(null);
  const [shouldCloseOnSuccess, setShouldCloseOnSuccess] = useState(false);
  const [buildsRefreshError, setBuildsRefreshError] = useState<string | null>(null);
  const [jobsRefreshError, setJobsRefreshError] = useState<string | null>(null);

  const {
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
  } = useJenkinsViewData(filter);

  const jenkinsHost = currentEnv?.host;
  const jenkinsUser = currentEnv?.user;
  const jenkinsToken = currentEnv?.token;

  useEffect(() => {
    setBuildsRefreshError(null);
    setJobsRefreshError(null);
    setNextRefreshTime(null);
  }, [currentEnvId]);

  useJenkinsDeepLink({
    currentEnvId,
    environments,
    onBuildJobChange: setBuildJob,
    onShouldCloseOnSuccessChange: setShouldCloseOnSuccess,
  });

  useJenkinsBuildPolling({
    enabled: Boolean(jenkinsHost && jenkinsUser && jenkinsToken),
    onLoadingChange: setMyBuildsLoading,
    onNextRefreshTimeChange: setNextRefreshTime,
    onRefresh: () => {
      setBuildsRefreshError(null);
    },
    onError: (error) => {
      logger.error('Failed to refresh Jenkins builds', error);
      setBuildsRefreshError(error.message);
    },
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
    shouldCloseOnSuccess,
    onBuildJobChange: setBuildJob,
    onExpandedUrlsChange: setExpandedUrls,
    onJobsRefreshErrorChange: setJobsRefreshError,
    onLoadingChange: setLoading,
  });

  return {
    buildJob,
    buildsRefreshError,
    currentEnvId,
    displayedBuilds,
    environments,
    expandedUrls,
    filter,
    filteredJobs,
    handleBuildSuccess,
    handleCancelBuild,
    handleEnvChange,
    handleSync,
    handleToggleShowOthers,
    jobTagsMap,
    jobTree,
    jobs,
    jobsRefreshError,
    lastBuildsRefreshTime,
    lastJobsRefreshTime,
    loading,
    myBuildsLoading,
    nextRefreshTime,
    openBuildDialog,
    closeBuildDialog,
    setFilter,
    showEmptyState: !jenkinsToken && environments.length === 0,
    showOthersBuilds,
    tags,
    toggleExpand,
  };
}
