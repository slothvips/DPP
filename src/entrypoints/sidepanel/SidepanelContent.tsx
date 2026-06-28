import React from 'react';
import { JenkinsView } from '@/features/jenkins/components/JenkinsView';
import { LinksView } from '@/features/links/components/LinksView';
import { KeepAliveTabPanel } from './KeepAliveTabPanel';
import { LazyTabPanel } from './LazyTabPanel';
import type { FeatureToggles, TabId } from './sidepanelTypes';

// 懒加载较重的视图,避免首屏加载全部代码
// - AIAssistantView / RecordingsView:原有懒加载,保留
// - ToolboxView:含 Monaco 编辑器(~5MB),必须懒加载
// - BlackboardView / HotNewsView:含 DB 查询和按需 fetch,懒加载减少首屏开销
const AIAssistantView = React.lazy(() =>
  import('@/features/aiAssistant/components/AIAssistantView').then((module) => ({
    default: module.AIAssistantView,
  }))
);
const BlackboardView = React.lazy(() =>
  import('@/features/blackboard/components/BlackboardView').then((module) => ({
    default: module.BlackboardView,
  }))
);
const HotNewsView = React.lazy(() =>
  import('@/features/hotNews/components/HotNewsView').then((module) => ({
    default: module.HotNewsView,
  }))
);
const RecordingsView = React.lazy(() =>
  import('@/features/recorder/components/RecordingsView').then((module) => ({
    default: module.RecordingsView,
  }))
);
const ToolboxView = React.lazy(() =>
  import('@/features/toolbox/components/ToolboxView').then((module) => ({
    default: module.ToolboxView,
  }))
);

interface SidepanelContentProps {
  activeTab: TabId;
  featureToggles: FeatureToggles;
  showJenkinsTab: boolean;
}

function SidepanelLoadingFallback() {
  return (
    <div className="flex h-full items-center justify-center px-4 py-6">
      <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-background/82 p-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 animate-pulse rounded-xl bg-primary/10" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-24 animate-pulse rounded-full bg-muted" />
            <div className="h-3 w-32 animate-pulse rounded-full bg-muted/80" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function SidepanelContent({
  activeTab,
  featureToggles,
  showJenkinsTab,
}: SidepanelContentProps) {
  return (
    <main
      className="relative min-h-0 min-w-0 flex-1 overflow-hidden px-3 pb-3 pt-1.5 [@media(max-height:520px)]:px-2 [@media(max-height:520px)]:pb-2 [@media(max-height:520px)]:pt-1"
      data-testid="main-content"
    >
      <div className="relative h-full min-h-0 min-w-0 overflow-hidden rounded-[22px] border border-border/55 bg-background/76 dark:bg-card/84">
        {/* 同步导入的轻量视图:始终挂载(KeepAlive) */}
        <KeepAliveTabPanel active={activeTab === 'links'} visible={featureToggles.links}>
          <LinksView />
        </KeepAliveTabPanel>
        <KeepAliveTabPanel active={activeTab === 'jenkins'} visible={showJenkinsTab}>
          <JenkinsView />
        </KeepAliveTabPanel>

        {/* 懒加载的重型视图:首次激活才挂载,之后保持(KeepAlive)
            这样用户不打开某 tab,该 tab 的代码就不会被下载 */}
        <LazyTabPanel
          active={activeTab === 'recorder'}
          visible={featureToggles.recorder}
          fallback={<SidepanelLoadingFallback />}
        >
          <RecordingsView />
        </LazyTabPanel>
        <LazyTabPanel
          active={activeTab === 'blackboard'}
          visible={featureToggles.blackboard}
          fallback={<SidepanelLoadingFallback />}
        >
          <BlackboardView />
        </LazyTabPanel>
        <LazyTabPanel
          active={activeTab === 'hotNews'}
          visible={featureToggles.hotNews}
          fallback={<SidepanelLoadingFallback />}
        >
          <HotNewsView />
        </LazyTabPanel>
        <LazyTabPanel
          active={activeTab === 'aiAssistant'}
          visible={featureToggles.aiAssistant}
          fallback={<SidepanelLoadingFallback />}
        >
          <AIAssistantView />
        </LazyTabPanel>
        <LazyTabPanel
          active={activeTab === 'playground'}
          visible={featureToggles.playground}
          fallback={<SidepanelLoadingFallback />}
        >
          <ToolboxView />
        </LazyTabPanel>
      </div>
    </main>
  );
}
