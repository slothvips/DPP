import { LayoutGrid } from 'lucide-react';
import React from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { GlobalSyncButton } from '@/components/GlobalSyncButton';
import { SystemSettingsButton } from '@/components/SystemSettingsButton';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import {
  type AIModuleItem,
  AIModuleLauncher,
} from '@/features/aiAssistant/components/AIModuleLauncher';
import { AIModuleDialog } from './AIModuleDialog';
import { LazyTabPanel } from './LazyTabPanel';
import { ModuleQuickPreview, hasModuleQuickPreview } from './ModuleQuickPreview';
import { DEFAULT_TAB_ORDER, TAB_CONFIG } from './sidepanelTabs';
import type { FeatureToggles, ModuleTabId, TabId } from './sidepanelTypes';

const QUICK_MODULE_LIMIT = 3;

const AIAssistantView = React.lazy(() =>
  import('@/features/aiAssistant/components/AIAssistantView').then((module) => ({
    default: module.AIAssistantView,
  }))
);
interface SidepanelContentProps {
  activeModule: ModuleTabId | null;
  featureToggles: FeatureToggles;
  onModuleSelect: (tabId: TabId) => void;
  onBackToAssistant: () => void;
  recentTabs: TabId[];
  pinnedTabs: TabId[];
  pinnedTabLimit: number;
  onTogglePinnedTab: (tabId: TabId) => void;
  isMinimalMode: boolean;
  showSyncButton: boolean;
}

interface ModuleNavigationProps {
  activeModule: ModuleTabId | null;
  moduleItems: AIModuleItem[];
  quickModuleItems: AIModuleItem[];
  pinnedTabs: TabId[];
  pinnedTabLimit: number;
  onModuleSelect: (tabId: TabId) => void;
  onTogglePinnedTab: (tabId: TabId) => void;
  showModuleLauncher: boolean;
  moduleLauncherPinned: boolean;
  onOpenChange: (open: boolean) => void;
  onClick: () => void;
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

function ModuleNavigation({
  activeModule,
  moduleItems,
  quickModuleItems,
  pinnedTabs,
  pinnedTabLimit,
  onModuleSelect,
  onTogglePinnedTab,
  showModuleLauncher,
  moduleLauncherPinned,
  onOpenChange,
  onClick,
}: ModuleNavigationProps) {
  return (
    <div className="grid min-w-0 gap-1.5">
      <div
        className="grid min-w-0 grid-flow-col auto-cols-fr gap-1"
        role="group"
        aria-label="模块导航"
      >
        <HoverCard
          open={showModuleLauncher}
          onOpenChange={onOpenChange}
          openDelay={0}
          closeDelay={100}
        >
          <HoverCardTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={moduleLauncherPinned ? '关闭模块面板' : '打开模块面板'}
              aria-expanded={showModuleLauncher}
              title={moduleLauncherPinned ? '关闭模块面板' : '固定模块面板'}
              onClick={onClick}
              className="h-7 w-full min-w-0 rounded-md border border-border/55 bg-muted/35 text-muted-foreground transition-colors hover:!translate-y-0 active:!translate-y-0 hover:bg-primary/10 hover:text-primary"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </HoverCardTrigger>
          <HoverCardContent
            align="start"
            side="top"
            sideOffset={8}
            className="w-[min(22rem,calc(100vw-1rem))] p-2"
          >
            <AIModuleLauncher
              activeId={activeModule ?? 'aiAssistant'}
              items={moduleItems}
              pinnedIds={pinnedTabs}
              pinLimit={pinnedTabLimit}
              onSelect={onModuleSelect}
              onTogglePin={onTogglePinnedTab}
            />
          </HoverCardContent>
        </HoverCard>
        {quickModuleItems.map((item) => {
          const button = (
            <Button
              key={item.id}
              variant="ghost"
              size="icon"
              onClick={() => onModuleSelect(item.id)}
              title={`${pinnedTabs.includes(item.id) ? '已固定' : '最近使用'}：${item.label}`}
              aria-label={`打开${pinnedTabs.includes(item.id) ? '已固定' : '最近使用'}模块：${item.label}`}
              className={`h-7 w-full min-w-0 rounded-md border border-border/55 bg-muted/35 text-muted-foreground transition-colors hover:!translate-y-0 active:!translate-y-0 hover:bg-primary/10 hover:text-primary ${item.id === activeModule ? 'border-primary/45 bg-primary/10 text-primary' : ''}`}
            >
              {item.icon}
            </Button>
          );
          if (!hasModuleQuickPreview(item.id)) return button;
          return (
            <HoverCard key={item.id} openDelay={0} closeDelay={150}>
              <HoverCardTrigger asChild>{button}</HoverCardTrigger>
              <HoverCardContent
                side="top"
                align="center"
                sideOffset={8}
                className="w-[min(24rem,calc(100vw-1rem))] p-0"
              >
                <ModuleQuickPreview moduleId={item.id} />
              </HoverCardContent>
            </HoverCard>
          );
        })}
      </div>
    </div>
  );
}

export function SidepanelContent({
  activeModule,
  featureToggles,
  onModuleSelect,
  onBackToAssistant,
  recentTabs,
  pinnedTabs,
  pinnedTabLimit,
  onTogglePinnedTab,
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
  const quickModuleItems = [
    ...pinnedTabs,
    ...recentTabs.filter((tabId) => !pinnedTabs.includes(tabId)),
  ]
    .slice(0, QUICK_MODULE_LIMIT)
    .flatMap((tabId) => {
      const item = moduleItems.find((moduleItem) => moduleItem.id === tabId);
      return item ? [item] : [];
    });
  const [showModuleLauncher, setShowModuleLauncher] = React.useState(false);
  const [moduleLauncherPinned, setModuleLauncherPinned] = React.useState(false);
  const handleModuleSelect = (tabId: TabId) => {
    setModuleLauncherPinned(false);
    setShowModuleLauncher(false);
    onModuleSelect(tabId);
  };
  const handleModuleLauncherOpenChange = (open: boolean) => {
    if (!moduleLauncherPinned || open) {
      setShowModuleLauncher(open);
    }
  };
  const handleModuleLauncherClick = () => {
    const nextPinned = !moduleLauncherPinned;
    setModuleLauncherPinned(nextPinned);
    setShowModuleLauncher(nextPinned);
  };

  const moduleNavigation = (
    <ModuleNavigation
      activeModule={activeModule}
      moduleItems={moduleItems}
      quickModuleItems={quickModuleItems}
      pinnedTabs={pinnedTabs}
      pinnedTabLimit={pinnedTabLimit}
      onModuleSelect={handleModuleSelect}
      onTogglePinnedTab={onTogglePinnedTab}
      showModuleLauncher={showModuleLauncher}
      moduleLauncherPinned={moduleLauncherPinned}
      onOpenChange={handleModuleLauncherOpenChange}
      onClick={handleModuleLauncherClick}
    />
  );

  return (
    <main
      className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background"
      data-testid="main-content"
    >
      <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
        {!featureToggles.aiAssistant && !isMinimalMode && (
          <div className="absolute inset-x-2 bottom-2 z-20 border-t border-border/45 bg-background/95 pt-1.5">
            {moduleNavigation}
          </div>
        )}
        <LazyTabPanel
          active={true}
          visible={featureToggles.aiAssistant}
          fallback={<SidepanelLoadingFallback />}
        >
          <ErrorBoundary moduleName={TAB_CONFIG.aiAssistant.label} className="h-full">
            <AIAssistantView
              onModuleSelect={onModuleSelect}
              sidebarFooter={
                !isMinimalMode ? (
                  <div className="grid min-w-0 gap-1.5">
                    {moduleNavigation}
                    {showSyncButton ? (
                      <div
                        className="min-w-0 border-t border-border/45 pt-1.5"
                        role="group"
                        aria-label="同步、显示与设置"
                      >
                        <GlobalSyncButton>
                          <ThemeToggle />
                          <SystemSettingsButton />
                        </GlobalSyncButton>
                      </div>
                    ) : (
                      <div
                        className="flex items-center justify-end gap-1 border-t border-border/45 pt-1.5"
                        role="group"
                        aria-label="显示与设置"
                      >
                        <ThemeToggle />
                        <SystemSettingsButton />
                      </div>
                    )}
                  </div>
                ) : undefined
              }
            />
          </ErrorBoundary>
        </LazyTabPanel>
      </div>
      <AIModuleDialog
        activeModule={activeModule}
        featureToggles={featureToggles}
        onClose={onBackToAssistant}
      />
    </main>
  );
}
