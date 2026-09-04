import { ArrowLeft, LayoutGrid, Lightbulb } from 'lucide-react';
import React from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { GlobalSyncButton } from '@/components/GlobalSyncButton';
import { SystemSettingsButton } from '@/components/SystemSettingsButton';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  type AIModuleItem,
  AIModuleLauncher,
} from '@/features/aiAssistant/components/AIModuleLauncher';
import { JenkinsView } from '@/features/jenkins/components/JenkinsView';
import { LinksView } from '@/features/links/components/LinksView';
import { KeepAliveTabPanel } from './KeepAliveTabPanel';
import { LazyTabPanel } from './LazyTabPanel';
import { DEFAULT_TAB_ORDER, TAB_CONFIG } from './sidepanelTabs';
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
  onModuleSelect: (tabId: TabId) => void;
  onBackToAssistant: () => void;
  recentTabs: TabId[];
  isMinimalMode: boolean;
  showSyncButton: boolean;
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
  onModuleSelect,
  onBackToAssistant,
  recentTabs,
  isMinimalMode,
  showSyncButton,
}: SidepanelContentProps) {
  const moduleItems: AIModuleItem[] = DEFAULT_TAB_ORDER.filter(
    (tabId) => tabId !== 'aiAssistant' && TAB_CONFIG[tabId].getVisible({ featureToggles })
  ).map((tabId) => ({
    id: tabId,
    label: TAB_CONFIG[tabId].label,
    description: TAB_CONFIG[tabId].description,
    icon: TAB_CONFIG[tabId].icon,
  }));
  const recentModuleItems = recentTabs.flatMap((tabId) => {
    const item = moduleItems.find((moduleItem) => moduleItem.id === tabId);
    return item ? [item] : [];
  });
  const [showModuleLauncher, setShowModuleLauncher] = React.useState(false);
  const [isGuideOpen, setIsGuideOpen] = React.useState(false);
  const activeTabConfig = TAB_CONFIG[activeTab];
  const handleModuleSelect = (tabId: TabId) => {
    setShowModuleLauncher(false);
    onModuleSelect(tabId);
  };

  return (
    <main
      className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background"
      data-testid="main-content"
    >
      <header className="relative z-40 flex min-w-0 shrink-0 flex-wrap items-center gap-2 border-b border-border/60 bg-background px-2.5 py-2 shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
        {activeTab === 'aiAssistant' ? (
          <div id="sidepanel-ai-toolbar-slot" className="min-w-max flex-1" />
        ) : (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-lg border border-border/55 bg-muted/35 text-muted-foreground"
              aria-label="返回 D 仔"
              title="返回 D 仔"
              onClick={onBackToAssistant}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {TAB_CONFIG[activeTab].icon}
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-sm font-semibold text-foreground">
                  {TAB_CONFIG[activeTab].label}
                </h1>
                <p className="truncate text-[11px] text-muted-foreground">
                  {TAB_CONFIG[activeTab].description}
                </p>
              </div>
              <Dialog open={isGuideOpen} onOpenChange={setIsGuideOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`${activeTabConfig.label}使用说明`}
                    title={`${activeTabConfig.label}使用说明`}
                    className="h-7 w-7 shrink-0 rounded-lg border border-border/55 bg-muted/35 text-muted-foreground hover:text-foreground"
                  >
                    <Lightbulb className="h-3.5 w-3.5" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[82vh] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-lg border-border/60 bg-background/96 shadow-xl sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>{activeTabConfig.label}使用说明</DialogTitle>
                    <DialogDescription>{activeTabConfig.usageGuide.summary}</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-3">
                    {activeTabConfig.usageGuide.sections.map((section) => (
                      <section key={section.title} className="grid gap-2">
                        <h3 className="text-sm font-medium text-foreground">{section.title}</h3>
                        <ul className="grid gap-1.5 text-sm leading-6 text-muted-foreground">
                          {section.items.map((item) => (
                            <li key={item} className="flex gap-2">
                              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </section>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </>
        )}
        {!isMinimalMode && (
          <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-1">
            <Dialog open={showModuleLauncher} onOpenChange={setShowModuleLauncher}>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="打开模块面板"
                  title="打开模块面板"
                  className="h-8 w-8 shrink-0 rounded-md border border-border/70 bg-muted/55 text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_1px_1px_rgba(0,0,0,0.08)] hover:bg-muted hover:text-foreground"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent
                aria-describedby={undefined}
                className="inset-0 left-0 top-0 flex h-full max-h-none w-full max-w-none translate-x-0 translate-y-0 gap-0 border-0 p-0 shadow-none sm:rounded-none"
              >
                <DialogTitle className="sr-only">模块入口</DialogTitle>
                <AIModuleLauncher
                  activeId={activeTab}
                  items={moduleItems}
                  onSelect={handleModuleSelect}
                />
              </DialogContent>
            </Dialog>
            {recentModuleItems.map((item) => (
              <Button
                key={item.id}
                variant="ghost"
                size="icon"
                onClick={() => handleModuleSelect(item.id)}
                title={`最近使用：${item.label}`}
                aria-label={`打开最近使用模块：${item.label}`}
                className="h-8 w-8 shrink-0 rounded-md border border-border/70 bg-muted/55 text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_1px_1px_rgba(0,0,0,0.08)] hover:bg-muted hover:text-foreground"
              >
                {item.icon}
              </Button>
            ))}
            <SystemSettingsButton />
            <ThemeToggle />
            {showSyncButton && <GlobalSyncButton />}
          </div>
        )}
      </header>
      <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
        {/* 同步导入的轻量视图:始终挂载(KeepAlive)；各模块独立 ErrorBoundary，避免单模块错误拖垮整页 */}
        <KeepAliveTabPanel active={activeTab === 'links'} visible={featureToggles.links}>
          <ErrorBoundary moduleName={TAB_CONFIG.links.label} className="h-full">
            <LinksView />
          </ErrorBoundary>
        </KeepAliveTabPanel>
        <KeepAliveTabPanel active={activeTab === 'jenkins'} visible={featureToggles.jenkins}>
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
            <AIAssistantView
              isActive={activeTab === 'aiAssistant'}
              onModuleSelect={onModuleSelect}
            />
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
            <TotpView isActive={activeTab === 'totp'} />
          </ErrorBoundary>
        </LazyTabPanel>
      </div>
    </main>
  );
}
