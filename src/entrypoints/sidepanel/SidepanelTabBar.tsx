import { TAB_CONFIG } from './sidepanelTabs';
import type { FeatureToggles, TabId } from './sidepanelTypes';

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
              onDragOver={(event) => handleDragOver(event, tabId)}
              onDragEnd={handleDragEnd}
            >
              {config.icon}
              <span>{config.label}</span>
            </button>
          );
        })}
    </div>
  );
}
