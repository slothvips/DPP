import { ChevronDown, ChevronRight, History } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { MyBuildItem, TagItem } from '@/db';
import { MyBuildRow } from '@/features/jenkins/components/MyBuildRow';
import { RefreshCountdown } from '@/features/jenkins/components/RefreshCountdown';

interface JenkinsBuildHistorySectionProps {
  displayedBuilds: MyBuildItem[];
  expanded: boolean;
  jobTagsMap: Map<string, TagItem[]>;
  loading: boolean;
  nextRefreshTime: number | null;
  onBuild: (build: MyBuildItem) => void;
  onCancel: (build: MyBuildItem) => void;
  onToggle: () => void;
  onToggleShowOthers: (checked: boolean) => void;
  showOthersBuilds: boolean;
}

export function JenkinsBuildHistorySection({
  displayedBuilds,
  expanded,
  jobTagsMap,
  loading,
  nextRefreshTime,
  onBuild,
  onCancel,
  onToggle,
  onToggleShowOthers,
  showOthersBuilds,
}: JenkinsBuildHistorySectionProps) {
  const hasBuilds = displayedBuilds.length > 0;

  return (
    <div className="mb-3 rounded-2xl border border-border/60 bg-background/78 p-2">
      <button
        type="button"
        className="group flex w-full cursor-pointer select-none items-center gap-2 rounded-xl border-0 bg-transparent p-2 text-left hover:bg-accent/40"
        onClick={onToggle}
      >
        <span className="p-0.5 rounded hover:bg-muted text-muted-foreground bg-transparent border-0 flex items-center justify-center">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>
        <div className="shrink-0 text-primary relative">
          <History className="w-4 h-4" />
        </div>
        <span className="text-sm font-medium">构建历史</span>
        <div
          className="ml-4 flex items-center gap-1.5 rounded-full bg-muted/60 px-2 py-1"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          role="presentation"
        >
          <Checkbox
            id="show-others-inline"
            checked={showOthersBuilds}
            onCheckedChange={(checked) => onToggleShowOthers(checked === true)}
            className="h-3.5 w-3.5"
          />
          <Label
            htmlFor="show-others-inline"
            className="text-xs text-muted-foreground cursor-pointer font-normal"
          >
            显示他人
          </Label>
        </div>
        <div className="flex-1" />
        {loading ? (
          <span className="text-xs text-muted-foreground mr-2 animate-pulse">刷新中...</span>
        ) : (
          <div className="flex items-center gap-2 mr-2">
            {nextRefreshTime && <RefreshCountdown targetTime={nextRefreshTime} />}
            <span className="rounded-full bg-muted/70 px-1.5 text-xs text-muted-foreground">
              {displayedBuilds.length}
            </span>
          </div>
        )}
      </button>
      {expanded && (
        <div className="pl-6 pr-1">
          {!hasBuilds ? (
            <div className="rounded-xl border border-dashed border-success/14 bg-success/4 p-3 text-xs text-muted-foreground">
              暂无构建记录
            </div>
          ) : (
            <div className="space-y-2">
              {displayedBuilds.map((build) => (
                <MyBuildRow
                  key={build.id}
                  build={build}
                  onBuild={() => onBuild(build)}
                  onCancel={() => onCancel(build)}
                  tags={jobTagsMap.get(build.jobUrl)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
