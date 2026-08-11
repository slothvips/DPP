import React from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { JenkinsView } from '@/features/jenkins/components/JenkinsView';
import { LinksView } from '@/features/links/components/LinksView';
import { cn } from '@/utils/cn';
import { KeepAliveTabPanel } from './KeepAliveTabPanel';
import { LazyTabPanel } from './LazyTabPanel';
import { TAB_CONFIG } from './sidepanelTabs';
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
const TotpView = React.lazy(() =>
  import('@/features/totp/components/TotpView').then((module) => ({
    default: module.TotpView,
  }))
);

interface SidepanelContentProps {
  activeTab: TabId;
  featureToggles: FeatureToggles;
  reserveFloatingNav?: boolean;
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
  reserveFloatingNav = false,
  showJenkinsTab,
}: SidepanelContentProps) {
  return (
    <main
      className={cn(
        'relative min-h-0 min-w-0 flex-1 overflow-hidden pb-3 pr-3 pt-1.5 [@media(max-height:520px)]:pb-2 [@media(max-height:520px)]:pr-2 [@media(max-height:520px)]:pt-1',
        reserveFloatingNav
          ? 'pl-[3.75rem] [@media(max-height:520px)]:pl-[3.5rem]'
          : 'pl-3 [@media(max-height:520px)]:pl-2'
      )}
      data-testid="main-content"
    >
      <div className="relative h-full min-h-0 min-w-0 overflow-hidden rounded-[22px] border border-border/55 bg-background/76 dark:bg-card/84">
        {/* 同步导入的轻量视图:始终挂载(KeepAlive)；各模块独立 ErrorBoundary，避免单模块错误拖垮整页 */}
        <KeepAliveTabPanel active={activeTab === 'links'} visible={featureToggles.links}>
          <ErrorBoundary moduleName={TAB_CONFIG.links.label} className="h-full">
            <LinksView />
          </ErrorBoundary>
        </KeepAliveTabPanel>
        <KeepAliveTabPanel active={activeTab === 'jenkins'} visible={showJenkinsTab}>
          <ErrorBoundary moduleName={TAB_CONFIG.jenkins.label} className="h-full">
            <JenkinsView />
          </ErrorBoundary>
        </KeepAliveTabPanel>

        {/* 懒加载的重型视图:首次激活才挂载,之后保持(KeepAlive)
            这样用户不打开某 tab,该 tab 的代码就不会被下载 */}
        <LazyTabPanel
          active={activeTab === 'recorder'}
          visible={featureToggles.recorder}
          fallback={<SidepanelLoadingFallback />}
        >
          <ErrorBoundary moduleName={TAB_CONFIG.recorder.label} className="h-full">
            <RecordingsView />
          </ErrorBoundary>
        </LazyTabPanel>
        <LazyTabPanel
          active={activeTab === 'blackboard'}
          visible={featureToggles.blackboard}
          fallback={<SidepanelLoadingFallback />}
        >
          <ErrorBoundary moduleName={TAB_CONFIG.blackboard.label} className="h-full">
            <BlackboardView />
          </ErrorBoundary>
        </LazyTabPanel>
        <LazyTabPanel
          active={activeTab === 'hotNews'}
          visible={featureToggles.hotNews}
          fallback={<SidepanelLoadingFallback />}
        >
          <ErrorBoundary moduleName={TAB_CONFIG.hotNews.label} className="h-full">
            <HotNewsView />
          </ErrorBoundary>
        </LazyTabPanel>
        <LazyTabPanel
          active={activeTab === 'aiAssistant'}
          visible={featureToggles.aiAssistant}
          fallback={<SidepanelLoadingFallback />}
        >
          <ErrorBoundary moduleName={TAB_CONFIG.aiAssistant.label} className="h-full">
            <AIAssistantView />
          </ErrorBoundary>
        </LazyTabPanel>
        <LazyTabPanel
          active={activeTab === 'playground'}
          visible={featureToggles.playground}
          fallback={<SidepanelLoadingFallback />}
        >
          <ErrorBoundary moduleName={TAB_CONFIG.playground.label} className="h-full">
            <ToolboxView />
          </ErrorBoundary>
        </LazyTabPanel>
        <LazyTabPanel
          active={activeTab === 'totp'}
          visible={featureToggles.totp}
          fallback={<SidepanelLoadingFallback />}
        >
          <ErrorBoundary moduleName={TAB_CONFIG.totp.label} className="h-full">
            <TotpView />
          </ErrorBoundary>
        </LazyTabPanel>
      </div>
    </main>
  );
}
