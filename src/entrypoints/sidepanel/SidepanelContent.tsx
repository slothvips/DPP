import { LayoutGrid } from 'lucide-react';
import React from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { GlobalSyncButton } from '@/components/GlobalSyncButton';
import { SystemSettingsButton } from '@/components/SystemSettingsButton';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  type AIModuleItem,
  AIModuleLauncher,
} from '@/features/aiAssistant/components/AIModuleLauncher';
import { AIModuleDialog } from './AIModuleDialog';
import { LazyTabPanel } from './LazyTabPanel';
import { DEFAULT_TAB_ORDER, TAB_CONFIG } from './sidepanelTabs';
import type { FeatureToggles, ModuleTabId, TabId } from './sidepanelTypes';

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
  activeModule,
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
        <div id="sidepanel-ai-toolbar-slot" className="min-w-max flex-1" />
        {!isMinimalMode && (
          <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-1">
            <Popover open={showModuleLauncher} onOpenChange={setShowModuleLauncher}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="打开模块面板"
                  title="打开模块面板"
                  className="h-8 w-8 shrink-0 rounded-lg border border-border/55 bg-muted/35 text-muted-foreground transition-colors hover:!translate-y-0 active:!translate-y-0 hover:bg-primary/10 hover:text-primary"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="center"
                side="bottom"
                sideOffset={8}
                className="w-[min(22rem,calc(100vw-1rem))] p-2"
              >
                <AIModuleLauncher
                  activeId={activeModule ?? 'aiAssistant'}
                  items={moduleItems}
                  onSelect={handleModuleSelect}
                />
              </PopoverContent>
            </Popover>
            {recentModuleItems.map((item) => (
              <Button
                key={item.id}
                variant="ghost"
                size="icon"
                onClick={() => handleModuleSelect(item.id)}
                title={`最近使用：${item.label}`}
                aria-label={`打开最近使用模块：${item.label}`}
                className={`h-8 w-8 shrink-0 rounded-lg border border-border/55 bg-muted/35 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary ${item.id === activeModule ? 'border-primary/45 bg-primary/10 text-primary' : ''}`}
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
        <LazyTabPanel
          active={true}
          visible={featureToggles.aiAssistant}
          fallback={<SidepanelLoadingFallback />}
        >
          <ErrorBoundary moduleName={TAB_CONFIG.aiAssistant.label} className="h-full">
            <AIAssistantView isActive={true} onModuleSelect={onModuleSelect} />
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
