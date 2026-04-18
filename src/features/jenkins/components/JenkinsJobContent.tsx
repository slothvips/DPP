import type { ReactNode } from 'react';
import type { JobItem, TagItem } from '@/db';
import { JobRow } from '@/features/jenkins/components/JobRow';
import { JobTreeNode } from '@/features/jenkins/components/JobTreeNode';
import type { TreeNode } from '@/features/jenkins/utils';

interface JenkinsJobContentProps {
  buildHistorySection: ReactNode;
  expandedUrls: Set<string>;
  filter: string;
  filteredJobs: JobItem[];
  jobTree: TreeNode[];
  jobs: JobItem[];
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
  jobTree,
  jobs,
  loading,
  onBuild,
  onToggle,
  tags,
}: JenkinsJobContentProps) {
  const hasJobs = jobs.length > 0;

  return (
    <div className="flex-1 overflow-auto border rounded-md">
      {!hasJobs ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-muted-foreground">
          {loading ? '正在从 Jenkins 获取数据...' : '暂无数据，请点击采集'}
        </div>
      ) : filter ? (
        <div className="divide-y">
          {filteredJobs.map((job) => (
            <JobRow key={job.url} job={job} onBuild={() => onBuild(job)} availableTags={tags} />
          ))}
        </div>
      ) : (
        <div className="p-2">
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
