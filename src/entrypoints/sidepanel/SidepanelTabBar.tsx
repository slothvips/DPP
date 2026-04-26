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
  handleTabChange,
  handleDragStart,
  handleDragOver,
  handleDragEnd,
}: SidepanelTabBarProps) {
  return (
    <div
      className="border-b border-border/50 bg-background/72 px-3 py-1.5 backdrop-blur dark:bg-background/78"
      data-testid="tab-container"
    >
      <div className="grid grid-cols-4 gap-0.5 rounded-2xl bg-muted/38 p-0.75 ring-1 ring-border/30 dark:bg-muted/62 dark:ring-border/55">
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
                className={`flex min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 py-1.75 text-xs font-medium cursor-grab active:cursor-grabbing select-none transition-all duration-200 ease-out active:scale-[0.985] ${
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
    </div>
  );
}
