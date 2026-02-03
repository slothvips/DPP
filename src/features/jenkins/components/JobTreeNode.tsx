import { ChevronDown, ChevronRight, Play, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { JobItem } from '@/db';
import { JobTagSelector } from '@/features/jenkins/components/JobTagSelector';
import {
  type TreeNode,
  getJobColorClass,
  getStatusClassName,
  isFolder,
  translateStatus,
} from '@/features/jenkins/utils';

interface JobTreeNodeProps {
  node: TreeNode;
  expandedUrls: Set<string>;
  onToggle: (url: string) => void;
  onBuild: (job: JobItem) => void;
  depth?: number;
}

export function JobTreeNode({
  node,
  expandedUrls,
  onToggle,
  onBuild,
  depth = 0,
}: JobTreeNodeProps) {
  const { job, children } = node;
  const jobIsFolder = isFolder(job, children.length);
  const isExpanded = expandedUrls.has(job.url);

  return (
    <div>
      <div
        className="flex items-start gap-2 p-1.5 rounded hover:bg-accent/50 cursor-pointer select-none group"
        style={{ paddingLeft: `${depth * 1.5 + 0.5}rem` }}
      >
        <button
          type="button"
          className="p-0.5 mt-0.5 rounded hover:bg-muted text-muted-foreground bg-transparent border-0 shrink-0"
          onClick={(e) => {
            if (jobIsFolder) {
              e.stopPropagation();
              onToggle(job.url);
            }
          }}
        >
          {jobIsFolder ? (
            isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )
          ) : (
            <div className="w-4 h-4" />
          )}
        </button>

        <div className={`shrink-0 mt-1 ${getJobColorClass(job.color)}`}>
          {jobIsFolder ? null : <Terminal className="w-4 h-4" />}
        </div>

        <div
          className="flex-1 min-w-0 text-left bg-transparent border-0 p-0 text-foreground cursor-pointer"
          onClick={() => jobIsFolder && onToggle(job.url)}
          onKeyDown={(e) => e.key === 'Enter' && jobIsFolder && onToggle(job.url)}
          title={
            job.lastStatus && job.lastStatus !== 'Unknown'
              ? `${translateStatus(job.lastStatus)} ${
                  job.lastBuildTime ? ` - ${new Date(job.lastBuildTime).toLocaleString()}` : ''
                }`
              : undefined
          }
          role={jobIsFolder ? 'button' : 'none'}
          tabIndex={jobIsFolder ? 0 : -1}
        >
          <span className="text-sm font-medium break-words align-middle mr-2 leading-relaxed">
            {job.name}
          </span>
          {!jobIsFolder && job.lastStatus && job.lastStatus !== 'Unknown' && (
            <span
              className={`inline-block align-middle text-[10px] px-1 rounded border whitespace-nowrap mr-2 ${getStatusClassName(
                job.lastStatus
              )}`}
            >
              {translateStatus(job.lastStatus)}
            </span>
          )}
          <div className="inline-block align-middle">
            <JobTagSelector jobUrl={job.url} />
          </div>
        </div>

        {!jobIsFolder && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity text-green-600 dark:text-green-500 shrink-0"
            onClick={() => onBuild(job)}
            title="构建"
          >
            <Play className="w-3 h-3" />
          </Button>
        )}
      </div>

      {jobIsFolder && isExpanded && (
        <div>
          {children.map((child) => (
            <JobTreeNode
              key={child.job.url}
              node={child}
              expandedUrls={expandedUrls}
              onToggle={onToggle}
              onBuild={onBuild}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
