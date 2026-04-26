import React, { Suspense } from 'react';
import { BlackboardView } from '@/features/blackboard/components/BlackboardView';
import { HotNewsView } from '@/features/hotNews/components/HotNewsView';
import { JenkinsView } from '@/features/jenkins/components/JenkinsView';
import { LinksView } from '@/features/links/components/LinksView';
import { ToolboxView } from '@/features/toolbox/components/ToolboxView';
import { KeepAliveTabPanel } from './KeepAliveTabPanel';
import type { FeatureToggles, TabId } from './sidepanelTypes';

const AIAssistantView = React.lazy(() =>
  import('@/features/aiAssistant/components/AIAssistantView').then((module) => ({
    default: module.AIAssistantView,
  }))
);
const RecordingsView = React.lazy(() =>
  import('@/features/recorder/components/RecordingsView').then((module) => ({
    default: module.RecordingsView,
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
    <main className="relative flex-1 overflow-hidden px-3 pb-3 pt-1.5" data-testid="main-content">
      <div className="relative h-full overflow-hidden rounded-[22px] border border-border/55 bg-background/76 dark:bg-card/84">
        <KeepAliveTabPanel active={activeTab === 'links'} visible={featureToggles.links}>
          <LinksView />
        </KeepAliveTabPanel>
        <KeepAliveTabPanel active={activeTab === 'jenkins'} visible={showJenkinsTab}>
          <JenkinsView />
        </KeepAliveTabPanel>
        <KeepAliveTabPanel active={activeTab === 'recorder'} visible={featureToggles.recorder}>
          <Suspense fallback={<SidepanelLoadingFallback />}>
            <RecordingsView />
          </Suspense>
        </KeepAliveTabPanel>
        <KeepAliveTabPanel active={activeTab === 'blackboard'} visible={featureToggles.blackboard}>
          <BlackboardView />
        </KeepAliveTabPanel>
        <KeepAliveTabPanel active={activeTab === 'hotNews'} visible={featureToggles.hotNews}>
          <HotNewsView />
        </KeepAliveTabPanel>
        <KeepAliveTabPanel
          active={activeTab === 'aiAssistant'}
          visible={featureToggles.aiAssistant}
        >
          <Suspense fallback={<SidepanelLoadingFallback />}>
            <AIAssistantView />
          </Suspense>
        </KeepAliveTabPanel>
        <KeepAliveTabPanel active={activeTab === 'playground'} visible={featureToggles.playground}>
          <ToolboxView />
        </KeepAliveTabPanel>
      </div>
    </main>
  );
}
