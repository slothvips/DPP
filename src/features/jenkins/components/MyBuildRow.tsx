import { Clock, ExternalLink, FileText, Info, Play, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tag } from '@/components/ui/tag';
import type { MyBuildItem, TagItem } from '@/db';
import { JenkinsBuildDetailsDialog } from '@/features/jenkins/components/JenkinsBuildDetailsDialog';
import { JenkinsBuildLogDialog } from '@/features/jenkins/components/JenkinsBuildLogDialog';
import { getStatusClassName, getStatusDotColor, translateStatus } from '@/features/jenkins/utils';

interface MyBuildRowProps {
  build: MyBuildItem;
  tags?: TagItem[];
  onBuild: () => void;
  onCancel: () => void;
  canBuild: boolean;
  canCancel: boolean;
  fullLogEnabled: boolean;
  pipelineEnabled: boolean;
  artifactsEnabled: boolean;
}

export function MyBuildRow({
  build,
  tags,
  onBuild,
  onCancel,
  canBuild,
  canCancel,
  fullLogEnabled,
  pipelineEnabled,
  artifactsEnabled,
}: MyBuildRowProps) {
  const [logOpen, setLogOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  return (
    <>
      <div className="group relative flex items-start gap-3 rounded-2xl border border-border/60 bg-background/88 p-3 shadow-sm transition-all duration-200 hover:border-success/12 hover:shadow-sm">
        <div className="shrink-0 mt-1">
          <div
            className="w-2 h-2 rounded-full mt-1.5"
            style={{ backgroundColor: getStatusDotColor(build.result) }}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="min-w-0 flex-1 truncate text-sm font-medium text-foreground"
              title={build.jobName}
            >
              {build.jobName}
            </span>
            <span className="shrink-0 font-mono text-xs text-muted-foreground">
              #{build.number}
            </span>
            {build.userName && (
              <span className="shrink-0 rounded-full bg-muted/70 px-1.5 py-0.5 text-xs text-muted-foreground">
                {build.userName}
              </span>
            )}
          </div>
          {tags && tags.length > 0 && (
            <div className="flex min-w-0 flex-wrap gap-1">
              {tags.map((tag) => (
                <Tag key={tag.id} name={tag.name} color={tag.color} size="sm" />
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className={`px-1 rounded border ${getStatusClassName(build.result)}`}>
              {translateStatus(build.result)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(build.timestamp).toLocaleString()}
            </span>
            {build.duration && build.duration > 0 && (
              <span>{(build.duration / 1000).toFixed(1)}s</span>
            )}
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-xl text-muted-foreground hover:bg-accent/70 hover:text-primary"
          onClick={() => setDetailsOpen(true)}
          title="查看构建详情"
        >
          <Info className="w-3 h-3" />
        </Button>
        {fullLogEnabled && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-xl text-muted-foreground hover:bg-accent/70 hover:text-primary"
            onClick={() => setLogOpen(true)}
            title="查看完整日志"
          >
            <FileText className="w-3 h-3" />
          </Button>
        )}
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-xl text-muted-foreground hover:bg-accent/70 hover:text-primary"
        >
          <a href={build.id} target="_blank" rel="noreferrer" title="打开 Jenkins">
            <ExternalLink className="w-3 h-3" />
          </a>
        </Button>
        {canBuild && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-xl text-muted-foreground hover:bg-success/8 hover:text-success dark:hover:bg-success/18 dark:hover:text-success"
            onClick={onBuild}
            title="再次构建"
          >
            <Play className="w-3 h-3" />
          </Button>
        )}
        {canCancel && build.building && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-xl text-muted-foreground hover:bg-destructive/8 hover:text-destructive dark:hover:bg-destructive/18 dark:hover:text-destructive"
            onClick={onCancel}
            title="取消构建"
          >
            <X className="w-3 h-3" />
          </Button>
        )}
      </div>

      <JenkinsBuildLogDialog
        build={build}
        open={logOpen}
        onOpenChange={setLogOpen}
        enabled={fullLogEnabled}
      />
      <JenkinsBuildDetailsDialog
        build={build}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        pipelineEnabled={pipelineEnabled}
        artifactsEnabled={artifactsEnabled}
      />
    </>
  );
}
