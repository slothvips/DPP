import { ChevronDown, ChevronRight, ExternalLink, Play, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { JobItem, TagItem } from '@/db';
import { JobTagSelector } from '@/features/jenkins/components/JobTagSelector';
import type { JenkinsJobActivity } from '@/features/jenkins/components/useJenkinsView';
import { getJobColorClass, getStatusClassName, translateStatus } from '@/features/jenkins/utils';

interface JobTreeNodeProps {
  job: JobItem;
  depth: number;
  isFolder: boolean;
  isExpanded: boolean;
  activity?: JenkinsJobActivity;
  index: number;
  onToggle: (url: string) => void;
  onBuild?: (job: JobItem) => void;
  onDetails: (job: JobItem) => void;
  availableTags?: TagItem[];
}

export function JobTreeNode({
  job,
  depth,
  isFolder,
  isExpanded,
  activity,
  index,
  onToggle,
  onBuild,
  onDetails,
  availableTags,
}: JobTreeNodeProps) {
  return (
    <div
      data-job-index={index}
      className="group flex items-start gap-2 rounded p-1.5 hover:bg-accent/50"
      style={{ paddingLeft: `${depth * 1.5 + 0.5}rem` }}
    >
      {isFolder ? (
        <button
          type="button"
          className="mt-0.5 shrink-0 rounded border-0 bg-transparent p-0.5 text-muted-foreground hover:bg-muted"
          aria-expanded={isExpanded}
          title={isExpanded ? '收起 Folder' : '展开 Folder'}
          onClick={() => onToggle(job.url)}
        >
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      ) : (
        <span className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      )}

      <div className={`shrink-0 mt-1 ${getJobColorClass(job.color)}`}>
        {isFolder ? null : <Terminal className="w-4 h-4" />}
      </div>

      <button
        type="button"
        data-job-row
        className="flex-1 min-w-0 text-left bg-transparent border-0 p-0 text-foreground cursor-pointer"
        onClick={() => onDetails(job)}
        title={job.url}
        tabIndex={0}
      >
        <span className="text-sm font-medium break-words align-middle mr-2 leading-relaxed">
          {job.name}
        </span>
        {activity && (
          <span
            className={`mr-2 inline-block align-middle rounded border px-1 text-[10px] whitespace-nowrap ${
              activity === 'building'
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-border bg-muted text-muted-foreground'
            }`}
          >
            {activity === 'building' ? '构建中' : '排队中'}
          </span>
        )}
        {!isFolder && job.lastStatus && job.lastStatus !== 'Unknown' && (
          <span
            className={`inline-block align-middle text-[10px] px-1 rounded border whitespace-nowrap mr-2 ${getStatusClassName(
              job.lastStatus
            )}`}
          >
            {translateStatus(job.lastStatus)}
          </span>
        )}
      </button>

      <div className="min-w-0 shrink align-middle">
        <JobTagSelector jobUrl={job.url} availableTags={availableTags} />
      </div>

      {!isFolder && onBuild && (
        <Button
          variant="ghost"
          size="icon"
          className="mt-0.5 h-6 w-6 shrink-0 text-success opacity-70 transition-opacity hover:opacity-100 dark:text-success"
          onClick={() => onBuild(job)}
          title="构建"
        >
          <Play className="w-3 h-3" />
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="mt-0.5 h-6 w-6 shrink-0 text-muted-foreground opacity-70 transition-opacity hover:text-primary hover:opacity-100"
        onClick={() => {
          void browser.tabs.create({ url: job.url });
        }}
        title="在 Jenkins 打开"
      >
        <ExternalLink className="w-3 h-3" />
      </Button>
    </div>
  );
}
