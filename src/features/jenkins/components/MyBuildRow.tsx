import { Clock, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tag } from '@/components/ui/tag';
import type { MyBuildItem, TagItem } from '@/db';
import { getStatusClassName, getStatusDotColor, translateStatus } from '@/features/jenkins/utils';

interface MyBuildRowProps {
  build: MyBuildItem;
  tags?: TagItem[];
  onBuild: () => void;
}

export function MyBuildRow({ build, tags, onBuild }: MyBuildRowProps) {
  return (
    <div className="flex items-start gap-2 p-1.5 rounded hover:bg-accent/50 group relative">
      <div className="shrink-0 mt-1">
        <div
          className="w-2 h-2 rounded-full mt-1.5"
          style={{ backgroundColor: getStatusDotColor(build.result) }}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <a
            href={build.id}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium hover:underline truncate text-foreground"
            title={build.jobName}
          >
            {build.jobName}
          </a>
          <span className="text-xs text-muted-foreground font-mono">#{build.number}</span>
          {tags && tags.length > 0 && (
            <div className="flex items-center gap-1">
              {tags.map((tag) => (
                <Tag key={tag.id} name={tag.name} color={tag.color} size="sm" />
              ))}
            </div>
          )}
          {build.userName && (
            <span className="text-xs bg-muted px-1 rounded text-muted-foreground">
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
        variant="ghost"
        size="icon"
        className="h-6 w-6 absolute right-1 top-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-green-600 hover:bg-green-100 dark:hover:text-green-400 dark:hover:bg-green-500/20"
        onClick={onBuild}
        title="再次构建"
      >
        <Play className="w-3 h-3" />
      </Button>
    </div>
  );
}
