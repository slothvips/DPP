import { useLiveQuery } from 'dexie-react-hooks';
import { Box, Flame, Link, MessageSquare, Settings, Sparkles, Video } from 'lucide-react';
import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
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

type TabId =
  | 'links'
  | 'jenkins'
  | 'hotNews'
  | 'recorder'
  | 'blackboard'
  | 'aiAssistant'
  | 'playground';

const DEFAULT_TAB_ORDER: TabId[] = [
  'blackboard',
  'jenkins',
  'links',
  'recorder',
  'hotNews',
  'aiAssistant',
  'playground',
];

// Tab 配置
const TAB_CONFIG: Record<
  TabId,
  {
    label: string;
    testid: string;
    icon: React.ReactNode;
    getVisible: (props: {
      featureToggles: Record<string, boolean>;
      showJenkinsTab: boolean;
    }) => boolean;
  }
> = {
  blackboard: {
    label: '黑板',
    testid: 'tab-blackboard',
    icon: <MessageSquare className="h-4 w-4" />,
    getVisible: ({ featureToggles }) => featureToggles.blackboard,
  },
  jenkins: {
    label: 'Jenkins',
    testid: 'tab-jenkins',
    icon: <JenkinsIcon className="h-4 w-4" />,
    getVisible: ({ showJenkinsTab }) => showJenkinsTab,
  },
  links: {
    label: '链接',
    testid: 'tab-links',
    icon: <Link className="h-4 w-4" />,
    getVisible: ({ featureToggles }) => featureToggles.links,
  },
  recorder: {
    label: '录制',
    testid: 'tab-recorder',
    icon: <Video className="h-4 w-4" />,
    getVisible: ({ featureToggles }) => featureToggles.recorder,
  },
  hotNews: {
    label: '资讯',
    testid: 'tab-hotnews',
    icon: <Flame className="h-4 w-4" />,
    getVisible: ({ featureToggles }) => featureToggles.hotNews,
  },
  aiAssistant: {
    label: 'D仔',
    testid: 'tab-ai-assistant',
    icon: <Sparkles className="h-4 w-4" />,
    getVisible: ({ featureToggles }) => featureToggles.aiAssistant,
  },
  playground: {
    label: '游乐园',
    testid: 'tab-playground',
    icon: <Box className="h-4 w-4" />,
    getVisible: ({ featureToggles }) => featureToggles.playground,
  },
};

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
    const blackboard = await db.settings.get('feature_blackboard_enabled');
    const jenkins = await db.settings.get('feature_jenkins_enabled');
    const recorder = await db.settings.get('feature_recorder_enabled');
    const aiAssistant = await db.settings.get('feature_ai_assistant_enabled');
    const playground = await db.settings.get('feature_playground_enabled');
    return {
      hotNews: hotNews?.value !== false,
      links: links?.value !== false,
      blackboard: blackboard?.value !== false,
      jenkins: jenkins?.value !== false,
      recorder: recorder?.value !== false,
      aiAssistant: aiAssistant?.value !== false,
      playground: playground?.value !== false,
    };
  }) ?? {
    hotNews: true,
    links: true,
    blackboard: true,
    jenkins: true,
    recorder: true,
    aiAssistant: true,
    playground: true,
  };

  const serverUrl = useLiveQuery(async () => {
    const setting = await db.settings.get('custom_server_url');
    return setting?.value as string | undefined;
  });

  const showSyncButton = !!serverUrl;
  const hasJenkins = (jenkinsEnvironments?.length ?? 0) > 0;
  const showJenkinsTab = hasJenkins && featureToggles.jenkins;

  const params = new URLSearchParams(window.location.search);
  const isMinimalMode = !!params.get('buildJobUrl');

  // Tab 顺序 state，支持拖拽排序
  const [tabOrder, setTabOrder] = useState<TabId[]>(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('dpp_tab_order');
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as TabId[];
          // 验证所有默认 tab 都在，并过滤掉未知值
          const validTabs = parsed.filter((t): t is TabId => DEFAULT_TAB_ORDER.includes(t));
          if (validTabs.length === DEFAULT_TAB_ORDER.length) {
            return validTabs;
          }
        } catch {
          // ignore parse errors
        }
      }
    }
    return DEFAULT_TAB_ORDER;
  });

  const [activeTab, setActiveTab] = useState<TabId>(() => {
    // Check URL params first for deep linking
    const tabParam = params.get('tab');
    if (tabParam && DEFAULT_TAB_ORDER.includes(tabParam as TabId)) {
      return tabParam as TabId;
    }

    const saved =
      typeof localStorage !== 'undefined' ? localStorage.getItem('dpp_active_tab') : null;
    if (saved && DEFAULT_TAB_ORDER.includes(saved as TabId)) {
      return saved as TabId;
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

  // 拖拽排序处理
  const [draggedTab, setDraggedTab] = useState<TabId | null>(null);

  // 使用 ref 保存最新的 tabOrder，避免闭包问题
  const tabOrderRef = useRef(tabOrder);
  tabOrderRef.current = tabOrder;

  const handleDragStart = useCallback((tabId: TabId) => {
    setDraggedTab(tabId);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, targetTab: TabId) => {
      e.preventDefault();
      if (!draggedTab || draggedTab === targetTab) return;

      setTabOrder((prev) => {
        const newOrder = [...prev];
        const draggedIndex = newOrder.indexOf(draggedTab);
        const targetIndex = newOrder.indexOf(targetTab);
        if (draggedIndex === -1 || targetIndex === -1) return prev;

        // 移除被拖拽的 tab，在目标位置插入
        newOrder.splice(draggedIndex, 1);
        newOrder.splice(targetIndex, 0, draggedTab);
        return newOrder;
      });
    },
    [draggedTab]
  );

  const handleDragEnd = useCallback(() => {
    setDraggedTab(null);
    // 使用 ref 获取最新的 tabOrder
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('dpp_tab_order', JSON.stringify(tabOrderRef.current));
    }
  }, []);

  const handleTabChange = (tab: TabId) => {
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
              {tabOrder
                .filter((tabId) => TAB_CONFIG[tabId].getVisible({ featureToggles, showJenkinsTab }))
                .map((tabId) => {
                  const config = TAB_CONFIG[tabId];
                  const isActive = activeTab === tabId;
                  const isDragging = draggedTab === tabId;

                  return (
                    <button
                      key={tabId}
                      type="button"
                      draggable
                      data-testid={config.testid}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium cursor-grab active:cursor-grabbing select-none transition-opacity ${
                        isActive
                          ? 'border-b-2 border-primary text-primary'
                          : 'text-muted-foreground hover:text-foreground'
                      } ${isDragging ? 'opacity-50' : ''}`}
                      onClick={() => handleTabChange(tabId)}
                      onDragStart={() => handleDragStart(tabId)}
                      onDragOver={(e) => handleDragOver(e, tabId)}
                      onDragEnd={handleDragEnd}
                    >
                      {config.icon}
                      <span>{config.label}</span>
                    </button>
                  );
                })}
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
                opacity: activeTab === 'jenkins' && showJenkinsTab ? 1 : 0,
                visibility: activeTab === 'jenkins' && showJenkinsTab ? 'visible' : 'hidden',
                pointerEvents: activeTab === 'jenkins' && showJenkinsTab ? 'auto' : 'none',
              }}
            >
              <JenkinsView />
            </div>
            <div
              className="absolute inset-0 p-2 transition-opacity duration-150"
              style={{
                opacity: activeTab === 'recorder' && featureToggles.recorder ? 1 : 0,
                visibility:
                  activeTab === 'recorder' && featureToggles.recorder ? 'visible' : 'hidden',
                pointerEvents:
                  activeTab === 'recorder' && featureToggles.recorder ? 'auto' : 'none',
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
                opacity: activeTab === 'blackboard' && featureToggles.blackboard ? 1 : 0,
                visibility:
                  activeTab === 'blackboard' && featureToggles.blackboard ? 'visible' : 'hidden',
                pointerEvents:
                  activeTab === 'blackboard' && featureToggles.blackboard ? 'auto' : 'none',
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
                opacity: activeTab === 'aiAssistant' && featureToggles.aiAssistant ? 1 : 0,
                visibility:
                  activeTab === 'aiAssistant' && featureToggles.aiAssistant ? 'visible' : 'hidden',
                pointerEvents:
                  activeTab === 'aiAssistant' && featureToggles.aiAssistant ? 'auto' : 'none',
              }}
            >
              <AIAssistantView />
            </div>
            <div
              className="absolute inset-0 p-2 transition-opacity duration-150"
              style={{
                opacity: activeTab === 'playground' && featureToggles.playground ? 1 : 0,
                visibility:
                  activeTab === 'playground' && featureToggles.playground ? 'visible' : 'hidden',
                pointerEvents:
                  activeTab === 'playground' && featureToggles.playground ? 'auto' : 'none',
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
