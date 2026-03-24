import { useLiveQuery } from 'dexie-react-hooks';
import { Box, Flame, Link, MessageSquare, Settings, Sparkles, Video } from 'lucide-react';
import React, { Suspense, useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { GlobalSyncButton } from '@/components/GlobalSyncButton';
import { Tips } from '@/components/Tips';
import { JenkinsIcon } from '@/components/ui/JenkinsIcon';
import { Button } from '@/components/ui/button';
import { ToastProvider } from '@/components/ui/toast';
import { db } from '@/db';
import type { JenkinsEnvironment } from '@/db';
import { BlackboardView } from '@/features/blackboard/components/BlackboardView';
import { HotNewsView } from '@/features/hotNews/components/HotNewsView';
import { JenkinsView } from '@/features/jenkins/components/JenkinsView';
import { LinksView } from '@/features/links/components/LinksView';
import { ToolboxView } from '@/features/toolbox/components/ToolboxView';
import { useTheme } from '@/hooks/useTheme';
import { ConfirmDialogProvider } from '@/utils/confirm-dialog';
import { logger } from '@/utils/logger';

// Tab 类型定义
type TabId =
  | 'links'
  | 'jenkins'
  | 'hotNews'
  | 'recorder'
  | 'blackboard'
  | 'aiAssistant'
  | 'playground';

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
    'links' | 'jenkins' | 'hotNews' | 'recorder' | 'blackboard' | 'aiAssistant' | 'playground'
  >(() => {
    // Check URL params first for deep linking
    const tabParam = params.get('tab');
    if (
      tabParam &&
      [
        'links',
        'jenkins',
        'hotNews',
        'recorder',
        'blackboard',
        'aiAssistant',
        'playground',
      ].includes(tabParam)
    ) {
      return tabParam as
        | 'links'
        | 'jenkins'
        | 'hotNews'
        | 'recorder'
        | 'blackboard'
        | 'aiAssistant'
        | 'playground';
    }

    const saved =
      typeof localStorage !== 'undefined' ? localStorage.getItem('dpp_active_tab') : null;
    if (
      saved &&
      [
        'links',
        'jenkins',
        'hotNews',
        'recorder',
        'blackboard',
        'aiAssistant',
        'playground',
      ].includes(saved)
    ) {
      return saved as
        | 'links'
        | 'jenkins'
        | 'hotNews'
        | 'recorder'
        | 'blackboard'
        | 'aiAssistant'
        | 'playground';
    }
    return 'blackboard';
  });

  useEffect(() => {
    // Trigger auto pull when mounted and whenever the side panel becomes visible
    const triggerAutoPull = () => {
      if (typeof browser !== 'undefined' && browser.runtime) {
        logger.debug('[SidePanel] Sending AUTO_SYNC_TRIGGER_PULL');
        browser.runtime
          .sendMessage({ type: 'AUTO_SYNC_TRIGGER_PULL' })
          .catch((e) => logger.error(e));
      }
    };

    triggerAutoPull();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        triggerAutoPull();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Only set default if no saved state
    const saved =
      typeof localStorage !== 'undefined' ? localStorage.getItem('dpp_active_tab') : null;
    if (!saved) {
      setActiveTab('blackboard');
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const handleTabChange = (
    tab: 'links' | 'jenkins' | 'hotNews' | 'recorder' | 'blackboard' | 'aiAssistant' | 'playground'
  ) => {
    setActiveTab(tab);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('dpp_active_tab', tab);
    }
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
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold" data-testid="app-title">
                  DPP
                </h1>
                {import.meta.env.MODE === 'development' && (
                  <span className="px-1.5 py-0.5 text-xs font-bold text-destructive-foreground bg-destructive rounded">
                    DEV
                  </span>
                )}
              </div>
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
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium ${activeTab === 'blackboard' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => handleTabChange('blackboard')}
              >
                <MessageSquare className="h-4 w-4" />
                <span>黑板</span>
              </button>
              {hasJenkins && (
                <button
                  type="button"
                  data-testid="tab-jenkins"
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium ${activeTab === 'jenkins' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                  onClick={() => handleTabChange('jenkins')}
                >
                  <JenkinsIcon className="h-4 w-4" />
                  <span>Jenkins</span>
                </button>
              )}
              {featureToggles.links && (
                <button
                  type="button"
                  data-testid="tab-links"
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium ${activeTab === 'links' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                  onClick={() => handleTabChange('links')}
                >
                  <Link className="h-4 w-4" />
                  <span>链接</span>
                </button>
              )}
              <button
                type="button"
                data-testid="tab-recorder"
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium ${activeTab === 'recorder' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => handleTabChange('recorder')}
              >
                <Video className="h-4 w-4" />
                <span>录制</span>
              </button>
              {featureToggles.hotNews && (
                <button
                  type="button"
                  data-testid="tab-hotnews"
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium ${activeTab === 'hotNews' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                  onClick={() => handleTabChange('hotNews')}
                >
                  <Flame className="h-4 w-4" />
                  <span>资讯</span>
                </button>
              )}
              <button
                type="button"
                data-testid="tab-ai-assistant"
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium ${activeTab === 'aiAssistant' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => handleTabChange('aiAssistant')}
              >
                <Sparkles className="h-4 w-4" />
                <span>D仔</span>
              </button>
              <button
                type="button"
                data-testid="tab-playground"
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium ${activeTab === 'playground' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => handleTabChange('playground')}
              >
                <Box className="h-4 w-4" />
                <span>游乐园</span>
              </button>
            </div>
          )}

          {/* Content - Keep-alive: 始终渲染所有 tab，用 opacity + visibility 保持状态并实现平滑过渡 */}
          <main className="flex-1 overflow-hidden p-2 relative" data-testid="main-content">
            {/* 使用 opacity 过渡实现平滑切换动画 */}
            <div
              className="absolute inset-0 p-2 transition-opacity duration-150"
              style={{
                opacity: activeTab === 'links' && featureToggles.links ? 1 : 0,
                visibility: activeTab === 'links' && featureToggles.links ? 'visible' : 'hidden',
                pointerEvents: activeTab === 'links' && featureToggles.links ? 'auto' : 'none',
              }}
            >
              <LinksView />
            </div>
            <div
              className="absolute inset-0 p-2 transition-opacity duration-150"
              style={{
                opacity: activeTab === 'jenkins' && hasJenkins ? 1 : 0,
                visibility: activeTab === 'jenkins' && hasJenkins ? 'visible' : 'hidden',
                pointerEvents: activeTab === 'jenkins' && hasJenkins ? 'auto' : 'none',
              }}
            >
              <JenkinsView />
            </div>
            <div
              className="absolute inset-0 p-2 transition-opacity duration-150"
              style={{
                opacity: activeTab === 'recorder' ? 1 : 0,
                visibility: activeTab === 'recorder' ? 'visible' : 'hidden',
                pointerEvents: activeTab === 'recorder' ? 'auto' : 'none',
              }}
            >
              <Suspense
                fallback={<div className="flex items-center justify-center h-full">加载中...</div>}
              >
                <RecordingsView />
              </Suspense>
            </div>
            <div
              className="absolute inset-0 p-2 transition-opacity duration-150"
              style={{
                opacity: activeTab === 'blackboard' ? 1 : 0,
                visibility: activeTab === 'blackboard' ? 'visible' : 'hidden',
                pointerEvents: activeTab === 'blackboard' ? 'auto' : 'none',
              }}
            >
              <BlackboardView />
            </div>
            <div
              className="absolute inset-0 p-2 transition-opacity duration-150"
              style={{
                opacity: activeTab === 'hotNews' && featureToggles.hotNews ? 1 : 0,
                visibility:
                  activeTab === 'hotNews' && featureToggles.hotNews ? 'visible' : 'hidden',
                pointerEvents: activeTab === 'hotNews' && featureToggles.hotNews ? 'auto' : 'none',
              }}
            >
              <HotNewsView />
            </div>
            <div
              className="absolute inset-0 p-2 transition-opacity duration-150"
              style={{
                opacity: activeTab === 'aiAssistant' ? 1 : 0,
                visibility: activeTab === 'aiAssistant' ? 'visible' : 'hidden',
                pointerEvents: activeTab === 'aiAssistant' ? 'auto' : 'none',
              }}
            >
              <AIAssistantView />
            </div>
            <div
              className="absolute inset-0 p-2 transition-opacity duration-150"
              style={{
                opacity: activeTab === 'playground' ? 1 : 0,
                visibility: activeTab === 'playground' ? 'visible' : 'hidden',
                pointerEvents: activeTab === 'playground' ? 'auto' : 'none',
              }}
            >
              <ToolboxView />
            </div>
          </main>
        </div>
      </ConfirmDialogProvider>
    </ToastProvider>
  );
}
