import { WifiOff } from 'lucide-react';
import type { ReactNode } from 'react';
import type { JobItem, TagItem } from '@/db';
import { JobRow } from '@/features/jenkins/components/JobRow';
import { JobTreeNode } from '@/features/jenkins/components/JobTreeNode';
import type { TreeNode } from '@/features/jenkins/utils';
import { cn } from '@/utils/cn';

interface JenkinsJobContentProps {
  buildHistorySection: ReactNode;
  expandedUrls: Set<string>;
  filter: string;
  filteredJobs: JobItem[];
  isShowingCachedJobs: boolean;
  jobTree: TreeNode[];
  jobs: JobItem[];
  jobsRefreshError: string | null;
  lastJobsRefreshTime: number | null;
  loading: boolean;
  onBuild: (job: JobItem) => void;
  onToggle: (url: string) => void;
  tags: TagItem[];
}

export function JenkinsJobContent({
  buildHistorySection,
  expandedUrls,
  filter,
  filteredJobs,
  isShowingCachedJobs,
  jobTree,
  jobs,
  jobsRefreshError,
  lastJobsRefreshTime,
  loading,
  onBuild,
  onToggle,
  tags,
}: JenkinsJobContentProps) {
  const hasJobs = jobs.length > 0;
  const hasSuccessfulJobsRefresh = lastJobsRefreshTime !== null;
  const shouldShowEmptyErrorState =
    !hasJobs && !hasSuccessfulJobsRefresh && Boolean(jobsRefreshError);
  const jobsStatusText = lastJobsRefreshTime
    ? `上次成功采集 ${new Date(lastJobsRefreshTime).toLocaleString()}`
    : hasJobs
      ? '显示本地缓存'
      : '尚未成功采集';

  return (
    <div className="flex-1 overflow-auto border rounded-md">
      {!hasJobs ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-muted-foreground">
          {loading ? (
            '正在从 Jenkins 获取数据...'
          ) : shouldShowEmptyErrorState ? (
            <div className="max-w-sm rounded-md border border-dashed border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
              暂无可用 Job 缓存，且尚未成功从 Jenkins 拉取 Job 列表，请检查网络或 Jenkins
              配置后重试。
            </div>
          ) : (
            <>
              {jobsRefreshError ? (
                <div
                  className={cn(
                    'mb-1 flex items-center gap-2 rounded-md border px-3 py-2 text-xs',
                    isShowingCachedJobs
                      ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300'
                      : 'border-border bg-muted/50 text-muted-foreground'
                  )}
                >
                  {isShowingCachedJobs ? <WifiOff className="h-3.5 w-3.5 shrink-0" /> : null}
                  <span>
                    {isShowingCachedJobs
                      ? `采集失败，继续显示缓存 · ${jobsStatusText}`
                      : jobsStatusText}
                  </span>
                </div>
              ) : null}
              <div>暂无数据，请点击采集</div>
            </>
          )}
        </div>
      ) : filter ? (
        <div className="divide-y">
          {filteredJobs.map((job) => (
            <JobRow key={job.url} job={job} onBuild={() => onBuild(job)} availableTags={tags} />
          ))}
        </div>
      ) : (
        <div className="p-2">
          <div
            className={cn(
              'mb-2 flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs',
              isShowingCachedJobs
                ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300'
                : 'border-border bg-muted/50 text-muted-foreground'
            )}
          >
            {isShowingCachedJobs ? <WifiOff className="h-3.5 w-3.5 shrink-0" /> : null}
            <span>
              {isShowingCachedJobs ? `采集失败，继续显示缓存 · ${jobsStatusText}` : jobsStatusText}
            </span>
          </div>
          {buildHistorySection}
          {jobTree.map((node) => (
            <JobTreeNode
              key={node.job.url}
              node={node}
              expandedUrls={expandedUrls}
              onToggle={onToggle}
              onBuild={onBuild}
            />
          ))}
        </div>
      )}
    </div>
  );
}
