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

export function SidepanelContent({
  activeTab,
  featureToggles,
  showJenkinsTab,
}: SidepanelContentProps) {
  return (
    <main className="flex-1 overflow-hidden p-2 relative" data-testid="main-content">
      <KeepAliveTabPanel active={activeTab === 'links'} visible={featureToggles.links}>
        <LinksView />
      </KeepAliveTabPanel>
      <KeepAliveTabPanel active={activeTab === 'jenkins'} visible={showJenkinsTab}>
        <JenkinsView />
      </KeepAliveTabPanel>
      <KeepAliveTabPanel active={activeTab === 'recorder'} visible={featureToggles.recorder}>
        <Suspense
          fallback={<div className="flex items-center justify-center h-full">加载中...</div>}
        >
          <RecordingsView />
        </Suspense>
      </KeepAliveTabPanel>
      <KeepAliveTabPanel active={activeTab === 'blackboard'} visible={featureToggles.blackboard}>
        <BlackboardView />
      </KeepAliveTabPanel>
      <KeepAliveTabPanel active={activeTab === 'hotNews'} visible={featureToggles.hotNews}>
        <HotNewsView />
      </KeepAliveTabPanel>
      <KeepAliveTabPanel active={activeTab === 'aiAssistant'} visible={featureToggles.aiAssistant}>
        <Suspense
          fallback={<div className="flex items-center justify-center h-full">加载中...</div>}
        >
          <AIAssistantView />
        </Suspense>
      </KeepAliveTabPanel>
      <KeepAliveTabPanel active={activeTab === 'playground'} visible={featureToggles.playground}>
        <ToolboxView />
      </KeepAliveTabPanel>
    </main>
  );
}
