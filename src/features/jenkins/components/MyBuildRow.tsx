import { Clock, ExternalLink, Play, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tag } from '@/components/ui/tag';
import type { MyBuildItem, TagItem } from '@/db';
import { getStatusClassName, getStatusDotColor, translateStatus } from '@/features/jenkins/utils';

interface MyBuildRowProps {
  build: MyBuildItem;
  tags?: TagItem[];
  onBuild: () => void;
  onCancel: () => void;
}

export function MyBuildRow({ build, tags, onBuild, onCancel }: MyBuildRowProps) {
  return (
    <div className="group relative flex items-start gap-3 rounded-2xl border border-border/60 bg-background/88 p-3 shadow-sm transition-all duration-200 hover:border-success/12 hover:shadow-sm">
      <div className="shrink-0 mt-1">
        <div
          className="w-2 h-2 rounded-full mt-1.5"
          style={{ backgroundColor: getStatusDotColor(build.result) }}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-medium truncate text-foreground" title={build.jobName}>
            {build.jobName}
          </span>
          <span className="text-xs text-muted-foreground font-mono">#{build.number}</span>
          {tags && tags.length > 0 && (
            <div className="flex items-center gap-1">
              {tags.map((tag) => (
                <Tag key={tag.id} name={tag.name} color={tag.color} size="sm" />
              ))}
            </div>
          )}
          {build.userName && (
            <span className="rounded-full bg-muted/70 px-1.5 py-0.5 text-xs text-muted-foreground">
              {build.userName}
            </span>
          )}
        </div>

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
        asChild
        variant="ghost"
        size="icon"
        className="h-7 w-7 rounded-xl text-muted-foreground hover:bg-accent/70 hover:text-primary"
      >
        <a href={build.id} target="_blank" rel="noreferrer" title="打开 Jenkins">
          <ExternalLink className="w-3 h-3" />
        </a>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 rounded-xl text-muted-foreground hover:bg-success/8 hover:text-success dark:hover:bg-success/18 dark:hover:text-success"
        onClick={onBuild}
        title="再次构建"
      >
        <Play className="w-3 h-3" />
      </Button>
      {build.building && (
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
  );
}
