import { History, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { VirtualList } from '@/components/ui/virtual-list';
import type { MyBuildItem, TagItem } from '@/db';
import { MyBuildRow } from '@/features/jenkins/components/MyBuildRow';
import { RefreshCountdown } from '@/features/jenkins/components/RefreshCountdown';
import {
  JenkinsBadge,
  JenkinsEmptyState,
  JenkinsPanel,
  JenkinsPanelHeader,
} from '@/features/jenkins/components/jenkinsUi';

interface JenkinsBuildHistorySectionProps {
  displayedBuilds: MyBuildItem[];
  stale?: boolean;
  jobTagsMap: Map<string, TagItem[]>;
  loading: boolean;
  nextRefreshTime: number | null;
  onRefresh: () => void;
  onBuild: (build: MyBuildItem) => void;
  onCancel: (build: MyBuildItem) => void;
  onToggleShowOthers: (checked: boolean) => void;
  showOthersBuilds: boolean;
  canBuild: boolean;
  canCancel: boolean;
  fullLogEnabled: boolean;
  pipelineEnabled: boolean;
  artifactsEnabled: boolean;
}

export function JenkinsBuildHistorySection({
  displayedBuilds,
  stale = false,
  jobTagsMap,
  loading,
  nextRefreshTime,
  onRefresh,
  onBuild,
  onCancel,
  onToggleShowOthers,
  showOthersBuilds,
  canBuild,
  canCancel,
  fullLogEnabled,
  pipelineEnabled,
  artifactsEnabled,
}: JenkinsBuildHistorySectionProps) {
  const hasBuilds = displayedBuilds.length > 0;

  return (
    <JenkinsPanel>
      <JenkinsPanelHeader
        icon={<History className="h-4 w-4 text-primary" />}
        title="运行"
        badge={
          stale ? (
            <JenkinsBadge tone="danger" title="远端不可用，显示本地缓存">
              离线缓存
            </JenkinsBadge>
          ) : undefined
        }
      >
        <div
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-muted/60 px-2 py-1"
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
            className="cursor-pointer text-xs font-normal text-muted-foreground"
          >
            显示他人
          </Label>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-primary"
          onClick={onRefresh}
          disabled={loading}
          title="刷新构建列表"
          aria-label="刷新构建列表"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
        {loading ? (
          <span className="animate-pulse text-xs text-muted-foreground">刷新中...</span>
        ) : (
          <div className="flex items-center gap-2">
            {nextRefreshTime && <RefreshCountdown targetTime={nextRefreshTime} />}
            <JenkinsBadge>{displayedBuilds.length}</JenkinsBadge>
          </div>
        )}
      </JenkinsPanelHeader>
      <div className="min-h-0 flex-1 p-2">
        {!hasBuilds ? (
          <JenkinsEmptyState>暂无构建记录</JenkinsEmptyState>
        ) : (
          <VirtualList
            items={displayedBuilds}
            estimateSize={72}
            overscan={8}
            containerClassName="h-full min-h-0 pb-1"
            renderItem={(build) => (
              <MyBuildRow
                key={build.id}
                build={build}
                onBuild={() => onBuild(build)}
                onCancel={() => onCancel(build)}
                canBuild={canBuild}
                canCancel={canCancel}
                fullLogEnabled={fullLogEnabled}
                pipelineEnabled={pipelineEnabled}
                artifactsEnabled={artifactsEnabled}
                tags={jobTagsMap.get(build.jobUrl)}
              />
            )}
          />
        )}
      </div>
    </JenkinsPanel>
  );
}
