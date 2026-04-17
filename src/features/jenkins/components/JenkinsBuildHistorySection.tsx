import { ChevronDown, ChevronRight, History, WifiOff } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { MyBuildItem, TagItem } from '@/db';
import { MyBuildRow } from '@/features/jenkins/components/MyBuildRow';
import { RefreshCountdown } from '@/features/jenkins/components/RefreshCountdown';
import { cn } from '@/utils/cn';

interface JenkinsBuildHistorySectionProps {
  displayedBuilds: MyBuildItem[];
  expanded: boolean;
  isShowingCachedBuilds: boolean;
  jobTagsMap: Map<string, TagItem[]>;
  lastBuildsRefreshTime: number | null;
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
  isShowingCachedBuilds,
  jobTagsMap,
  lastBuildsRefreshTime,
  loading,
  nextRefreshTime,
  onBuild,
  onCancel,
  onToggle,
  onToggleShowOthers,
  showOthersBuilds,
}: JenkinsBuildHistorySectionProps) {
  const hasBuilds = displayedBuilds.length > 0;
  const hasSuccessfulRefresh = lastBuildsRefreshTime !== null;
  const shouldShowEmptyErrorState = !hasBuilds && !hasSuccessfulRefresh;
  const statusText = lastBuildsRefreshTime
    ? `上次成功刷新 ${new Date(lastBuildsRefreshTime).toLocaleString()}`
    : hasBuilds
      ? '显示本地缓存'
      : '尚未成功刷新';

  return (
    <div className="mb-2">
      <button
        type="button"
        className="flex items-center gap-2 p-1.5 rounded hover:bg-accent/50 cursor-pointer select-none group w-full text-left bg-transparent border-0"
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
          className="flex items-center gap-1.5 ml-4"
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
            <span className="text-xs text-muted-foreground bg-muted px-1.5 rounded-full">
              {displayedBuilds.length}
            </span>
          </div>
        )}
      </button>
      {expanded && (
        <div className="pl-6">
          <div
            className={cn(
              'mb-2 flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs',
              isShowingCachedBuilds
                ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300'
                : 'border-border bg-muted/50 text-muted-foreground'
            )}
          >
            {isShowingCachedBuilds ? <WifiOff className="h-3.5 w-3.5 shrink-0" /> : null}
            <span>
              {isShowingCachedBuilds ? `刷新失败，继续显示缓存 · ${statusText}` : statusText}
            </span>
          </div>
          {!hasBuilds ? (
            shouldShowEmptyErrorState ? (
              <div className="rounded-md border border-dashed border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                暂无可用缓存，且尚未成功从 Jenkins 拉取构建历史，请检查网络或 Jenkins 配置后重试。
              </div>
            ) : (
              <div className="p-2 text-xs text-muted-foreground">暂无构建记录</div>
            )
          ) : (
            <div className="space-y-1">
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
