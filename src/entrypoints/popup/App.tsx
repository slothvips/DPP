import { useLiveQuery } from 'dexie-react-hooks';
import { Settings } from 'lucide-react';
import React, { Suspense, useEffect, useState } from 'react';
import { GlobalSyncButton } from '@/components/GlobalSyncButton';
import { Tips } from '@/components/Tips';
import { Button } from '@/components/ui/button';
import { ToastProvider } from '@/components/ui/toast';
import { db } from '@/db';
import type { JenkinsEnvironment } from '@/db';
import { BlackboardView } from '@/features/blackboard/components/BlackboardView';
import { HotNewsView } from '@/features/hotNews/components/HotNewsView';
import { JenkinsView } from '@/features/jenkins/components/JenkinsView';
import { LinksView } from '@/features/links/components/LinksView';
import { useTheme } from '@/hooks/useTheme';
import { ConfirmDialogProvider } from '@/utils/confirm-dialog';

// 动态导入大型组件以减少初始体积
const AIAssistantView = React.lazy(() =>
  import('@/features/aiAssistant/components/AIAssistantView').then((m) => ({
    default: m.AIAssistantView,
  }))
);
const RecordingsView = React.lazy(() =>
  import('@/features/recorder/components/RecordingsView').then((m) => ({
    default: m.RecordingsView,
  }))
);

export function App() {
  useTheme();

  const jenkinsEnvironments = useLiveQuery(async () => {
    const setting = await db.settings.get('jenkins_environments');
    return setting?.value as JenkinsEnvironment[] | undefined;
  });

  const featureToggles = useLiveQuery(async () => {
    const hotNews = await db.settings.get('feature_hotnews_enabled');
    const links = await db.settings.get('feature_links_enabled');
    return {
      hotNews: hotNews?.value !== false,
      links: links?.value !== false,
    };
  }) ?? { hotNews: true, links: true };

  const serverUrl = useLiveQuery(async () => {
    const setting = await db.settings.get('custom_server_url');
    return setting?.value as string | undefined;
  });

  const showSyncButton = !!serverUrl;
  const hasJenkins = (jenkinsEnvironments?.length ?? 0) > 0;

  const params = new URLSearchParams(window.location.search);
  const isMinimalMode = !!params.get('buildJobUrl');

  const [activeTab, setActiveTab] = useState<
    'links' | 'jenkins' | 'hotNews' | 'recorder' | 'blackboard' | 'aiAssistant'
  >(() => {
    // Check URL params first for deep linking
    const tabParam = params.get('tab');
    if (
      tabParam &&
      ['links', 'jenkins', 'hotNews', 'recorder', 'blackboard', 'aiAssistant'].includes(tabParam)
    ) {
      return tabParam as
        | 'links'
        | 'jenkins'
        | 'hotNews'
        | 'recorder'
        | 'blackboard'
        | 'aiAssistant';
    }

    const saved = localStorage.getItem('dpp_active_tab');
    if (
      saved &&
      ['links', 'jenkins', 'hotNews', 'recorder', 'blackboard', 'aiAssistant'].includes(saved)
    ) {
      return saved as 'links' | 'jenkins' | 'hotNews' | 'recorder' | 'blackboard' | 'aiAssistant';
    }
    return 'blackboard';
  });

  useEffect(() => {
    // Only set default if no saved state
    const saved = localStorage.getItem('dpp_active_tab');
    if (!saved) {
      setActiveTab('blackboard');
    }
  }, []);

  const handleTabChange = (
    tab: 'links' | 'jenkins' | 'hotNews' | 'recorder' | 'blackboard' | 'aiAssistant'
  ) => {
    setActiveTab(tab);
    localStorage.setItem('dpp_active_tab', tab);
  };

  const openSettings = () => {
    browser.tabs.create({ url: browser.runtime.getURL('/options.html') });
  };

  return (
    <ToastProvider>
      <ConfirmDialogProvider>
        <div className="flex flex-col h-full bg-background text-foreground">
          {/* Header */}
          {!isMinimalMode && (
            <header className="flex items-center justify-between p-4 border-b">
              <h1 className="text-lg font-bold" data-testid="app-title">
                DPP
              </h1>
              <Tips />
              <div className="flex items-center gap-1">
                {showSyncButton && <GlobalSyncButton />}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={openSettings}
                  data-testid="settings-button"
                >
                  <Settings className="w-4 h-4" />
                </Button>
              </div>
            </header>
          )}

          {/* Tabs */}
          {!isMinimalMode && (
            <div className="flex border-b" data-testid="tab-container">
              <button
                type="button"
                data-testid="tab-blackboard"
                className={`flex-1 py-2 text-sm font-medium ${activeTab === 'blackboard' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => handleTabChange('blackboard')}
              >
                黑板
              </button>
              {hasJenkins && (
                <button
                  type="button"
                  data-testid="tab-jenkins"
                  className={`flex-1 py-2 text-sm font-medium ${activeTab === 'jenkins' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                  onClick={() => handleTabChange('jenkins')}
                >
                  Jenkins
                </button>
              )}
              {featureToggles.links && (
                <button
                  type="button"
                  data-testid="tab-links"
                  className={`flex-1 py-2 text-sm font-medium ${activeTab === 'links' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                  onClick={() => handleTabChange('links')}
                >
                  链接
                </button>
              )}
              <button
                type="button"
                data-testid="tab-recorder"
                className={`flex-1 py-2 text-sm font-medium ${activeTab === 'recorder' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => handleTabChange('recorder')}
              >
                录制
              </button>
              {featureToggles.hotNews && (
                <button
                  type="button"
                  data-testid="tab-hotnews"
                  className={`flex-1 py-2 text-sm font-medium ${activeTab === 'hotNews' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                  onClick={() => handleTabChange('hotNews')}
                >
                  资讯
                </button>
              )}
              <button
                type="button"
                data-testid="tab-ai-assistant"
                className={`flex-1 py-2 text-sm font-medium ${activeTab === 'aiAssistant' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => handleTabChange('aiAssistant')}
              >
                AI
              </button>
            </div>
          )}

          {/* Content */}
          <main className="flex-1 overflow-hidden p-2" data-testid="main-content">
            <Suspense
              fallback={<div className="flex items-center justify-center h-full">加载中...</div>}
            >
              {activeTab === 'links' && featureToggles.links && <LinksView />}
              {activeTab === 'jenkins' && hasJenkins && <JenkinsView />}
              {activeTab === 'recorder' && <RecordingsView />}
              {activeTab === 'blackboard' && <BlackboardView />}
              {activeTab === 'hotNews' && featureToggles.hotNews && <HotNewsView />}
              {activeTab === 'aiAssistant' && <AIAssistantView />}
            </Suspense>
          </main>
        </div>
      </ConfirmDialogProvider>
    </ToastProvider>
  );
}
