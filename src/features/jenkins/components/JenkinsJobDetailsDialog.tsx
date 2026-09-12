import { ExternalLink, FileText, LoaderCircle, RefreshCw, Terminal } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { JobItem } from '@/db';
import { JenkinsSectionHeader } from '@/features/jenkins/components/jenkinsUi';
import { JenkinsService } from '@/features/jenkins/service';
import { getJobColorClass, getStatusClassName, translateStatus } from '@/features/jenkins/utils';
import { logger } from '@/utils/logger';

interface JenkinsJobDetailsDialogProps {
  job: JobItem | null;
  open: boolean;
  onBuild: (job: JobItem) => void;
  onOpenChange: (open: boolean) => void;
  canBuild: boolean;
}

type JobDetails = Record<string, unknown>;

function asRecord(value: unknown): JobDetails | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as JobDetails)
    : null;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

export function JenkinsJobDetailsDialog({
  job,
  open,
  onBuild,
  onOpenChange,
  canBuild,
}: JenkinsJobDetailsDialogProps) {
  const [details, setDetails] = useState<JobDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState(0);

  useEffect(() => {
    if (!open || !job) return;
    let active = true;
    setDetails(null);
    setError(null);

    void JenkinsService.getJobDetails(job.url, job.env)
      .then((result) => {
        if (!active) return;
        const parsed = asRecord(result);
        setDetails(parsed);
        if (!parsed) setError('Jenkins 返回了无效的 Job 详情');
      })
      .catch((cause: unknown) => {
        if (!active) return;
        logger.error('Failed to fetch Jenkins job details', cause);
        setError(cause instanceof Error ? cause.message : 'Job 详情加载失败');
      });

    return () => {
      active = false;
    };
  }, [job, open, requestId]);

  const displayName = asString(details?.displayName) || asString(details?.fullName) || job?.name;
  const description = asString(details?.description);
  const className = asString(details?._class);
  const buildable = details?.buildable;
  const builds = Array.isArray(details?.builds) ? details.builds : [];
  const lastBuild = asRecord(details?.lastBuild);
  const lastBuildNumber = asNumber(lastBuild?.number);
  const lastBuildResult = asString(lastBuild?.result);
  const healthReport = Array.isArray(details?.healthReport) ? details.healthReport : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-1rem)] w-[calc(100vw-1rem)] max-w-xl flex-col gap-4 p-4">
        <DialogHeader className="pr-8">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Terminal className={`h-4 w-4 ${getJobColorClass(job?.color)}`} />
            <span className="truncate">{displayName || 'Jenkins Job'}</span>
          </DialogTitle>
          <DialogDescription className="break-all">{job?.url}</DialogDescription>
        </DialogHeader>

        {!details && !error && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            加载 Job 详情...
          </div>
        )}
        {error && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={() => setRequestId((value) => value + 1)}>
              <RefreshCw className="mr-2 h-4 w-4" />
              重试
            </Button>
          </div>
        )}
        {details && job && (
          <div className="min-h-0 overflow-auto text-sm">
            <dl className="grid grid-cols-[5rem_minmax(0,1fr)] gap-x-3 gap-y-2">
              <dt className="text-muted-foreground">状态</dt>
              <dd>
                <span
                  className={`rounded border px-1.5 py-0.5 text-xs ${getStatusClassName(job.lastStatus)}`}
                >
                  {translateStatus(job.lastStatus)}
                </span>
              </dd>
              <dt className="text-muted-foreground">类型</dt>
              <dd className="break-words">{className || job.type || '未知'}</dd>
              <dt className="text-muted-foreground">可构建</dt>
              <dd>{buildable === true ? '是' : buildable === false ? '否' : '未知'}</dd>
              <dt className="text-muted-foreground">构建数量</dt>
              <dd>{builds.length}</dd>
              {lastBuildNumber !== undefined && (
                <>
                  <dt className="text-muted-foreground">最近构建</dt>
                  <dd>
                    #{lastBuildNumber}
                    {lastBuildResult ? ` · ${translateStatus(lastBuildResult)}` : ''}
                  </dd>
                </>
              )}
              {healthReport.length > 0 && (
                <>
                  <dt className="text-muted-foreground">健康检查</dt>
                  <dd className="space-y-1">
                    {healthReport.slice(0, 5).map((item, index) => {
                      const report = asRecord(item);
                      return (
                        <p key={index} className="break-words">
                          {formatValue(report?.description) || '健康检查'}
                          {asNumber(report?.score) !== undefined ? ` · ${report?.score}%` : ''}
                        </p>
                      );
                    })}
                  </dd>
                </>
              )}
            </dl>
            {description && (
              <section
                className="mt-4 border-t border-border pt-4"
                aria-labelledby="jenkins-job-description"
              >
                <JenkinsSectionHeader
                  id="jenkins-job-description"
                  icon={<FileText className="h-4 w-4 text-primary" />}
                  title="描述"
                />
                <p className="whitespace-pre-wrap break-words text-xs text-muted-foreground">
                  {description}
                </p>
              </section>
            )}
          </div>
        )}

        {job && (
          <DialogFooter>
            <Button asChild variant="outline">
              <a href={job.url} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                打开 Jenkins
              </a>
            </Button>
            <Button
              onClick={() => onBuild(job)}
              disabled={!canBuild || details?.buildable === false}
            >
              构建
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
