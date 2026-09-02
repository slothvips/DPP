import { Plus, ServerCog, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BuildDialog } from '@/features/jenkins/components/BuildDialog';
import { JenkinsBuildHistorySection } from '@/features/jenkins/components/JenkinsBuildHistorySection';
import { JenkinsJobContent } from '@/features/jenkins/components/JenkinsJobContent';
import { JenkinsToolbar } from '@/features/jenkins/components/JenkinsToolbar';
import { useJenkinsView } from '@/features/jenkins/components/useJenkinsView';
import { JenkinsEnvManager } from '@/features/settings/components/JenkinsEnvManager';

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
    showOthersBuilds,
    tags,
    toggleExpand,
  } = useJenkinsView();

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-4 overflow-auto">
      <JenkinsToolbar
        currentEnvId={currentEnvId}
        environments={environments}
        filter={filter}
        loading={loading}
        onEnvChange={handleEnvChange}
        onFilterChange={setFilter}
        onSync={handleSync}
        showEnvManager={environments.length > 0}
      />

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
        <div className="flex min-h-[20rem] min-h-0 flex-1 flex-col gap-4">
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
        />
      )}
    </div>
  );
}
