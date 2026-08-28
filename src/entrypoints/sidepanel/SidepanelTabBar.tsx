import { PanelLeftClose, PanelLeftOpen, Settings } from 'lucide-react';
import { browser } from 'wxt/browser';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/cn';
import { TAB_CONFIG } from './sidepanelTabs';
import type { FeatureToggles, TabId } from './sidepanelTypes';

function getActiveTabClassName() {
  return 'bg-background text-foreground ring-1 ring-primary/8 dark:bg-card dark:ring-primary/14';
}

interface SidepanelTabBarProps {
  activeTab: TabId;
  draggedTab: TabId | null;
  tabOrder: TabId[];
  featureToggles: FeatureToggles;
  isExpanded: boolean;
  handleTabChange: (tabId: TabId) => void;
  handleDragStart: (tabId: TabId) => void;
  handleDragOver: (event: React.DragEvent<HTMLButtonElement>, tabId: TabId) => void;
  handleDragEnd: () => void;
  onCollapse: () => void;
  onExpand: () => void;
}

export function SidepanelTabBar({
  activeTab,
  draggedTab,
  tabOrder,
  featureToggles,
  isExpanded,
  handleTabChange,
  handleDragStart,
  handleDragOver,
  handleDragEnd,
  onCollapse,
  onExpand,
}: SidepanelTabBarProps) {
  const openSettings = () => {
    void browser.tabs.create({ url: browser.runtime.getURL('/options.html') });
  };

  return (
    <div
      className={cn(
        'z-30 flex shrink-0 flex-col overflow-hidden border border-border/50 bg-background/88 py-2 backdrop-blur transition-all duration-200 ease-out dark:bg-background/88',
        isExpanded
          ? 'relative h-full w-[min(10rem,100%)] max-w-full rounded-none border-y-0 border-l-0 shadow-none'
          : 'absolute bottom-2 left-2 top-2 w-11 rounded-2xl ring-1 ring-border/35 shadow-lg'
      )}
      data-testid="tab-container"
    >
      <div className="px-2 pb-2">
        {isExpanded ? (
          <div className="flex items-center justify-between rounded-xl bg-muted/35 px-2 py-1.5 text-xs font-medium text-muted-foreground">
            <span>菜单</span>
            <button
              type="button"
              aria-label="收起菜单"
              className="rounded-lg p-1 transition-colors hover:bg-background/70 hover:text-foreground"
              onClick={onCollapse}
              title="收起菜单"
            >
              <PanelLeftClose className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            aria-expanded={false}
            aria-label="展开菜单"
            className="flex h-7 w-full items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground"
            onClick={onExpand}
            title="展开菜单"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 overflow-y-auto px-2">
        {tabOrder
          .filter((tabId) => TAB_CONFIG[tabId].getVisible({ featureToggles }))
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
                title={config.label}
                className={cn(
                  'flex min-w-0 cursor-grab select-none items-center rounded-xl py-2.5 text-xs font-medium transition-all duration-200 ease-out active:scale-[0.985] active:cursor-grabbing',
                  isExpanded ? 'justify-start gap-2 px-2.5' : 'justify-center px-0',
                  isActive
                    ? getActiveTabClassName()
                    : 'text-muted-foreground hover:bg-background/64 hover:text-foreground',
                  isDragging && 'opacity-50'
                )}
                onClick={() => handleTabChange(tabId)}
                onDragStart={() => handleDragStart(tabId)}
                onDragOver={(event) => handleDragOver(event, tabId)}
                onDragEnd={handleDragEnd}
              >
                <span className="shrink-0">{config.icon}</span>
                <span className={cn('truncate', !isExpanded && 'sr-only')}>{config.label}</span>
              </button>
            );
          })}
      </div>

      <div className="flex flex-col gap-2 border-t border-border/30 px-2 pt-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={openSettings}
          data-testid="settings-button"
          title="设置"
          className={cn(
            'flex h-auto items-center rounded-xl py-2 text-xs font-medium text-muted-foreground hover:bg-background/64 hover:text-foreground',
            isExpanded ? 'justify-start gap-2 px-2.5' : 'justify-center px-0'
          )}
        >
          <Settings className="h-4 w-4 shrink-0" />
          <span className={cn(!isExpanded && 'sr-only')}>设置</span>
        </Button>
      </div>
    </div>
  );
}
