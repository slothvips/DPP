import { cn } from '@/utils/cn';
import { CloseIcon, type PanelTab, type TabConfig } from './playerSidePanelShared';

interface PlayerSidePanelHeaderProps {
  activeTab: PanelTab;
  onClose: () => void;
  onTabChange: (tab: PanelTab) => void;
  tabs: TabConfig[];
}

export function PlayerSidePanelHeader({
  activeTab,
  onClose,
  onTabChange,
  tabs,
}: PlayerSidePanelHeaderProps) {
  return (
    <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
      <div className="flex items-center gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => !tab.disabled && onTabChange(tab.id)}
            disabled={tab.disabled}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors',
              activeTab === tab.id
                ? 'bg-primary text-primary-foreground'
                : tab.disabled
                  ? 'text-muted-foreground cursor-not-allowed'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.badge !== undefined && tab.badge > 0 && (
              <span
                className={cn(
                  'ml-1 px-1.5 py-0.5 text-xs rounded-full',
                  activeTab === tab.id
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>
      <button
        onClick={onClose}
        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
        title="关闭面板"
      >
        <CloseIcon />
      </button>
    </div>
  );
}
