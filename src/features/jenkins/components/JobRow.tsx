import { ExternalLink, Play, Terminal } from 'lucide-react';
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
    <div className="group flex flex-col gap-2 rounded-2xl border border-border/60 bg-background/90 p-3 shadow-sm transition-all duration-200 hover:border-success/12 hover:shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex gap-3 overflow-hidden flex-1">
          <div className={`mt-1 shrink-0 ${getJobColorClass(job.color)}`}>
            {jobIsFolder ? null : <Terminal className="w-4 h-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="block">
              <span className="font-medium break-words mr-2 align-middle text-sm">
                {job.fullName || job.name}
              </span>
              {jobIsFolder && (
                <span className="mr-2 inline-block rounded-full bg-muted/70 px-1.5 py-0.5 align-middle text-[10px] font-medium text-muted-foreground">
                  Folder
                </span>
              )}
              {job.lastStatus && job.lastStatus !== 'Unknown' && (
                <span
                  className={`inline-block align-middle text-[10px] px-1.5 py-0.5 rounded-md border mr-2 font-medium ${getStatusClassName(
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
            <div className="text-xs text-muted-foreground truncate mt-0.5">{job.url}</div>
          </div>
        </div>

        <div className="ml-2 flex shrink-0 gap-2 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-xl text-muted-foreground hover:bg-accent/70 hover:text-primary"
          >
            <a href={job.url} target="_blank" rel="noreferrer" title="打开 Jenkins">
              <ExternalLink className="w-4 h-4" />
            </a>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-xl text-muted-foreground hover:bg-success/8 hover:text-success dark:hover:bg-success/18 dark:hover:text-success"
            title="构建"
            onClick={onBuild}
          >
            <Play className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="w-full">
        <JobTagSelector jobUrl={job.url} availableTags={availableTags} />
      </div>
    </div>
  );
}
