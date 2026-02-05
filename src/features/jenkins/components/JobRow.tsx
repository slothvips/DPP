import { Play, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { JobItem, TagItem } from '@/db';
import { JobTagSelector } from '@/features/jenkins/components/JobTagSelector';
import {
  getJobColorClass,
  getStatusClassName,
  isFolder,
  translateStatus,
} from '@/features/jenkins/utils';

interface JobRowProps {
  job: JobItem;
  onBuild: () => void;
  availableTags?: TagItem[];
}

export function JobRow({ job, onBuild, availableTags }: JobRowProps) {
  const jobIsFolder = isFolder(job);

  return (
    <div className="p-3 flex items-start justify-between hover:bg-accent/50 group transition-colors">
      <div className="flex gap-3 overflow-hidden flex-1">
        <div className={`mt-1 shrink-0 ${getJobColorClass(job.color)}`}>
          {jobIsFolder ? null : <Terminal className="w-4 h-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="block">
            <a
              href={job.url}
              target="_blank"
              rel="noreferrer"
              className="font-medium hover:underline break-words mr-2 align-middle text-sm"
            >
              {job.fullName || job.name}
            </a>
            {jobIsFolder && (
              <span className="inline-block align-middle text-[10px] bg-muted px-1 rounded text-muted-foreground mr-2">
                Folder
              </span>
            )}
            {job.lastStatus && job.lastStatus !== 'Unknown' && (
              <span
                className={`inline-block align-middle text-[10px] px-1 rounded border mr-2 ${getStatusClassName(
                  job.lastStatus
                )}`}
              >
                {translateStatus(job.lastStatus)}
              </span>
            )}
            {job.lastBuildTime && (
              <span className="inline-block align-middle text-[10px] text-muted-foreground">
                {new Date(job.lastBuildTime).toLocaleString()}
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground truncate mt-1">{job.url}</div>
          <div className="mt-2">
            <JobTagSelector jobUrl={job.url} availableTags={availableTags} />
          </div>
        </div>
      </div>

      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-green-600 hover:bg-green-100 dark:hover:text-green-400 dark:hover:bg-green-500/20"
          title="构建"
          onClick={onBuild}
        >
          <Play className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
