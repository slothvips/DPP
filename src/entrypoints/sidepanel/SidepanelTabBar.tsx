import { Settings } from 'lucide-react';
import { browser } from 'wxt/browser';
import { GlobalSyncButton } from '@/components/GlobalSyncButton';
import { Button } from '@/components/ui/button';
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
  showJenkinsTab: boolean;
  showSyncButton: boolean;
  handleTabChange: (tabId: TabId) => void;
  handleDragStart: (tabId: TabId) => void;
  handleDragOver: (event: React.DragEvent<HTMLButtonElement>, tabId: TabId) => void;
  handleDragEnd: () => void;
}

export function SidepanelTabBar({
  activeTab,
  draggedTab,
  tabOrder,
  featureToggles,
  showJenkinsTab,
  showSyncButton,
  handleTabChange,
  handleDragStart,
  handleDragOver,
  handleDragEnd,
}: SidepanelTabBarProps) {
  const openSettings = () => {
    browser.tabs.create({ url: browser.runtime.getURL('/options.html') });
  };
  return (
    <div
      className="flex h-full w-36 shrink-0 flex-col overflow-hidden border-r border-border/50 bg-background/72 py-2 backdrop-blur dark:bg-background/78"
      data-testid="tab-container"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 overflow-y-auto px-2">
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
                className={`flex min-w-0 items-center justify-start gap-2 rounded-xl px-2.5 py-2.5 text-xs font-medium cursor-grab active:cursor-grabbing select-none transition-all duration-200 ease-out active:scale-[0.985] ${
                  isActive
                    ? getActiveTabClassName()
                    : 'text-muted-foreground hover:bg-background/64 hover:text-foreground'
                } ${isDragging ? 'opacity-50' : ''}`}
                onClick={() => handleTabChange(tabId)}
                onDragStart={() => handleDragStart(tabId)}
                onDragOver={(event) => handleDragOver(event, tabId)}
                onDragEnd={handleDragEnd}
              >
                <span className="shrink-0">{config.icon}</span>
                <span className="truncate">{config.label}</span>
              </button>
            );
          })}
      </div>

      <div className="flex flex-col gap-2 border-t border-border/30 px-2 pt-3">
        {showSyncButton && <GlobalSyncButton orientation="vertical" />}
        <Button
          variant="ghost"
          size="sm"
          onClick={openSettings}
          data-testid="settings-button"
          className="flex h-auto items-center justify-start gap-2 rounded-xl px-2.5 py-2 text-xs font-medium text-muted-foreground hover:bg-background/64 hover:text-foreground"
        >
          <Settings className="h-4 w-4 shrink-0" />
          <span>设置</span>
        </Button>
      </div>
    </div>
  );
}
