import { BuildDialog } from '@/features/jenkins/components/BuildDialog';
import { JenkinsBuildHistorySection } from '@/features/jenkins/components/JenkinsBuildHistorySection';
import { JenkinsEmptyState } from '@/features/jenkins/components/JenkinsEmptyState';
import { JenkinsJobContent } from '@/features/jenkins/components/JenkinsJobContent';
import { JenkinsToolbar } from '@/features/jenkins/components/JenkinsToolbar';
import { useJenkinsView } from '@/features/jenkins/components/useJenkinsView';

export function JenkinsView() {
  const {
    buildJob,
    closeBuildDialog,
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
    loading,
    myBuildsLoading,
    nextRefreshTime,
    openBuildDialog,
    setFilter,
    showEmptyState,
    showOthersBuilds,
    tags,
    toggleExpand,
  } = useJenkinsView();

  if (showEmptyState) {
    return <JenkinsEmptyState />;
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      <JenkinsToolbar
        currentEnvId={currentEnvId}
        environments={environments}
        filter={filter}
        loading={loading}
        onEnvChange={handleEnvChange}
        onFilterChange={setFilter}
        onSync={handleSync}
      />

      <JenkinsJobContent
        buildHistorySection={
          <JenkinsBuildHistorySection
            displayedBuilds={displayedBuilds}
            expanded={expandedUrls.has('__build_history__')}
            jobTagsMap={jobTagsMap}
            loading={myBuildsLoading}
            nextRefreshTime={nextRefreshTime}
            onBuild={(build) =>
              openBuildDialog({ url: build.jobUrl, name: build.jobName, envId: build.env })
            }
            onCancel={handleCancelBuild}
            onToggle={() => toggleExpand('__build_history__')}
            onToggleShowOthers={handleToggleShowOthers}
            showOthersBuilds={showOthersBuilds}
          />
        }
        expandedUrls={expandedUrls}
        filter={filter}
        filteredJobs={filteredJobs}
        jobTree={jobTree}
        jobs={jobs}
        loading={loading}
        onBuild={(job) => openBuildDialog({ url: job.url, name: job.name, envId: job.env })}
        onToggle={toggleExpand}
        tags={tags}
      />

      {buildJob && (
        <BuildDialog
          isOpen={!!buildJob}
          jobUrl={buildJob.url}
          jobName={buildJob.name}
          envId={buildJob.envId}
          onClose={closeBuildDialog}
          onBuildSuccess={handleBuildSuccess}
        />
      )}
    </div>
  );
}
