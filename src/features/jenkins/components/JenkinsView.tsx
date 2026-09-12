import { Plus, ServerCog, ShieldCheck } from 'lucide-react';
import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { BuildDialog } from '@/features/jenkins/components/BuildDialog';
import { JenkinsBuildHistorySection } from '@/features/jenkins/components/JenkinsBuildHistorySection';
import { JenkinsJobContent } from '@/features/jenkins/components/JenkinsJobContent';
import { JenkinsJobDetailsDialog } from '@/features/jenkins/components/JenkinsJobDetailsDialog';
import { JenkinsQueueSection } from '@/features/jenkins/components/JenkinsQueueSection';
import { JenkinsToolbar } from '@/features/jenkins/components/JenkinsToolbar';
import { useJenkinsView } from '@/features/jenkins/components/useJenkinsView';
import type { JenkinsFeatureToggles } from '@/features/jenkins/featureFlags';
import type { JenkinsRecentJob } from '@/features/jenkins/recentJobs';
import { JenkinsEnvManager } from '@/features/settings/components/JenkinsEnvManager';

export function JenkinsView({
  jenkinsFeatureToggles,
  active = true,
}: {
  jenkinsFeatureToggles: JenkinsFeatureToggles;
  active?: boolean;
}) {
  const tabListId = useId();
  const {
    activeView,
    buildJob,
    buildsStale,
    closeBuildDialog,
    closeJobDetails,
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
    openBuildDialog,
    openJobDetails,
    recentJobs,
    refreshBuilds,
    setFilter,
    setSortBy,
    setStatusFilter,
    setTagFilterId,
    setActiveView,
    showOthersBuilds,
    sortBy,
    statusFilter,
    tagFilterId,
    tags,
    toggleExpand,
  } = useJenkinsView({ jenkinsFeatureToggles, active });

  const handleOpenRecent = (ref: JenkinsRecentJob) => {
    const job = jobs.find((candidate) => candidate.url === ref.url);
    openJobDetails(job ?? { url: ref.url, name: ref.name, env: ref.envId });
  };

  if (!jenkinsFeatureToggles.workbench) {
    return (
      <div className="flex h-full items-center justify-center px-4 text-sm text-muted-foreground">
        Jenkins 新版工作台已关闭
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-3 overflow-hidden p-3 [@media(max-height:520px)]:gap-2 [@media(max-height:520px)]:p-2 sm:gap-4 sm:p-4">
      {environments.length > 0 && (
        <div className="shrink-0">
          <JenkinsToolbar
            currentEnvId={currentEnvId}
            environments={environments}
            filter={filter}
            loading={loading}
            onEnvChange={handleEnvChange}
            onFilterChange={setFilter}
            onSync={handleSync}
          />
        </div>
      )}

      {environments.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center rounded-2xl border border-border/60 bg-muted/15 px-5 py-10">
          <div className="flex w-full max-w-md flex-col items-center text-center">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_4px_10px_rgba(0,0,0,0.08)]">
              <ServerCog className="h-8 w-8" />
            </div>
            <h2 className="text-base font-semibold text-foreground">连接 Jenkins</h2>
            <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
              添加一个 Jenkins 环境后，即可在这里浏览 Job、触发构建和查看构建记录。
            </p>
            <JenkinsEnvManager
              trigger={
                <Button className="mt-6 gap-2 rounded-xl px-4 shadow-sm">
                  <Plus className="h-4 w-4" />
                  添加 Jenkins 环境
                </Button>
              }
            />
            <div className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-success" />
                凭证仅保存在本机
              </span>
              <span>支持自动填充已登录凭证</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3 sm:gap-4">
          <div
            id={tabListId}
            className="flex shrink-0 items-center gap-1 rounded-xl border border-border/55 bg-muted/35 p-1"
            role="tablist"
            aria-label="Jenkins 工作台视图"
          >
            {[
              ['run', '运行'],
              ['jobs', '任务'],
              ...(jenkinsFeatureToggles.queue ? [['queue', '队列']] : []),
            ].map(([value, label]) => (
              <button
                key={value}
                id={`${tabListId}-${value}`}
                type="button"
                role="tab"
                aria-selected={activeView === value}
                aria-controls={`jenkins-panel-${value}`}
                tabIndex={activeView === value ? 0 : -1}
                className={`flex-1 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  activeView === value
                    ? 'bg-background font-medium text-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'
                }`}
                onClick={() => setActiveView(value as 'run' | 'jobs' | 'queue')}
                onKeyDown={(event) => {
                  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
                  event.preventDefault();
                  const views: Array<'run' | 'jobs' | 'queue'> = jenkinsFeatureToggles.queue
                    ? (['run', 'jobs', 'queue'] as const)
                    : (['run', 'jobs'] as const);
                  const currentIndex = views.indexOf(value as (typeof views)[number]);
                  const nextIndex =
                    event.key === 'ArrowRight'
                      ? (currentIndex + 1) % views.length
                      : (currentIndex - 1 + views.length) % views.length;
                  setActiveView(views[nextIndex]);
                  document.getElementById(`${tabListId}-${views[nextIndex]}`)?.focus();
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {activeView === 'queue' && jenkinsFeatureToggles.queue ? (
            <div
              id="jenkins-panel-queue"
              role="tabpanel"
              aria-labelledby={`${tabListId}-queue`}
              className="min-h-0 flex-1 overflow-hidden"
            >
              <JenkinsQueueSection envId={currentEnvId} active={active} />
            </div>
          ) : activeView === 'jobs' ? (
            <div
              id="jenkins-panel-jobs"
              role="tabpanel"
              aria-labelledby={`${tabListId}-jobs`}
              className="min-h-0 flex-1 overflow-hidden"
            >
              <JenkinsJobContent
                hasActiveFilter={hasActiveFilter}
                expandedUrls={expandedUrls}
                filteredJobs={filteredJobs}
                jobTree={jobTree}
                jobs={jobs}
                loading={loading}
                jobActivity={jobActivity}
                onBuild={
                  jenkinsFeatureToggles.buildLifecycle
                    ? (job) => openBuildDialog({ url: job.url, name: job.name, envId: job.env })
                    : undefined
                }
                onDetails={openJobDetails}
                onToggle={toggleExpand}
                recentJobs={recentJobs}
                onOpenRecent={handleOpenRecent}
                onExpandAll={expandAll}
                onCollapseAll={collapseAll}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                tagFilterId={tagFilterId}
                onTagFilterChange={setTagFilterId}
                sortBy={sortBy}
                onSortChange={setSortBy}
                tags={tags}
              />
            </div>
          ) : (
            <div
              id="jenkins-panel-run"
              role="tabpanel"
              aria-labelledby={`${tabListId}-run`}
              className="min-h-0 flex-1 overflow-hidden"
            >
              <JenkinsBuildHistorySection
                displayedBuilds={displayedBuilds}
                stale={buildsStale}
                jobTagsMap={jobTagsMap}
                loading={myBuildsLoading}
                nextRefreshTime={nextRefreshTime}
                onRefresh={refreshBuilds}
                onBuild={(build) =>
                  openBuildDialog({ url: build.jobUrl, name: build.jobName, envId: build.env })
                }
                onCancel={handleCancelBuild}
                canBuild={jenkinsFeatureToggles.buildLifecycle}
                canCancel={jenkinsFeatureToggles.buildLifecycle}
                fullLogEnabled={jenkinsFeatureToggles.fullLog}
                pipelineEnabled={jenkinsFeatureToggles.pipeline}
                artifactsEnabled={jenkinsFeatureToggles.artifacts}
                onToggleShowOthers={handleToggleShowOthers}
                showOthersBuilds={showOthersBuilds}
              />
            </div>
          )}
        </div>
      )}

      {buildJob && (
        <BuildDialog
          isOpen={!!buildJob}
          jobUrl={buildJob.url}
          jobName={buildJob.name}
          envId={buildJob.envId}
          onClose={closeBuildDialog}
          onBuildSuccess={handleBuildSuccess}
          enabled={jenkinsFeatureToggles.buildLifecycle}
        />
      )}
      <JenkinsJobDetailsDialog
        job={detailsJob}
        open={detailsJob !== null}
        onBuild={(job) => {
          closeJobDetails();
          openBuildDialog({ url: job.url, name: job.name, envId: job.env });
        }}
        onOpenChange={(open) => {
          if (!open) closeJobDetails();
        }}
        canBuild={jenkinsFeatureToggles.buildLifecycle}
      />
    </div>
  );
}
