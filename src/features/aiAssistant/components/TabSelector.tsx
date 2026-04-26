// TabSelector - 选择 PageAgent 工作标签页
import { Globe, Loader2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/utils/cn';
import { useTabSelector } from './useTabSelector';

interface TabSelectorProps {
  selectedTabId: number | null;
  onTabSelect: (tabId: number | null) => void;
  className?: string;
}

export function TabSelector({ selectedTabId, onTabSelect, className }: TabSelectorProps) {
  const {
    handleAlwaysCurrentClick,
    handleTabClick,
    isLoading,
    isOpen,
    selectedTab,
    setIsOpen,
    tabs,
  } = useTabSelector({ selectedTabId, onTabSelect });

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-8 items-center gap-1.5 rounded-xl border-border/60 bg-background/96 text-xs',
            className
          )}
          title="选择 Page Agent 工作标签页（仅支持 SPA）"
        >
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : selectedTab ? (
            <>
              {selectedTab.favIconUrl ? (
                <img
                  src={selectedTab.favIconUrl}
                  alt=""
                  className="w-3.5 h-3.5 object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <Globe className="w-3.5 h-3.5" />
              )}
              <span className="max-w-[80px] truncate">{selectedTab.title}</span>
              <span className="text-muted-foreground text-[10px]">#{selectedTabId}</span>
            </>
          ) : selectedTabId === null ? (
            <>
              <Zap className="w-3.5 h-3.5" />
              <span>始终为当前标签</span>
            </>
          ) : (
            <>
              <Globe className="w-3.5 h-3.5" />
              <span>选择标签页</span>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 rounded-2xl border border-border/60 p-3 shadow-md"
        align="end"
      >
        <div className="text-xs font-medium text-muted-foreground px-2 py-1.5">
          选择 Page Agent 工作标签页
        </div>
        {/* 始终为当前标签选项 */}
        <button
          onClick={handleAlwaysCurrentClick}
          className={cn(
            'w-full flex items-center gap-2 px-2 py-2 rounded-md text-left text-sm',
            'hover:bg-accent hover:text-accent-foreground',
            'transition-colors cursor-pointer',
            selectedTabId === null && 'bg-accent'
          )}
        >
          <Zap className="w-4 h-4 flex-shrink-0 text-primary" />
          <div className="flex-1 min-w-0">
            <div className="truncate text-primary font-medium">始终为当前标签</div>
            <div className="text-xs text-muted-foreground">每次使用时自动选择当前活动标签页</div>
          </div>
        </button>
        <div className="h-px bg-border my-1" />
        <div className="text-xs font-medium text-muted-foreground px-2 py-1.5">
          或选择固定标签页
        </div>
        <div className="max-h-48 overflow-y-auto">
          {tabs.length === 0 && !isLoading ? (
            <div className="text-xs text-muted-foreground px-2 py-4 text-center">
              没有可用的标签页
            </div>
          ) : (
            tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-2 rounded-md text-left text-sm',
                  'hover:bg-accent hover:text-accent-foreground',
                  'transition-colors cursor-pointer',
                  tab.id === selectedTabId && 'bg-accent'
                )}
              >
                {tab.favIconUrl ? (
                  <img
                    src={tab.favIconUrl}
                    alt=""
                    className="w-4 h-4 object-contain flex-shrink-0"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <Globe className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="truncate">{tab.title}</div>
                  <div className="text-xs text-muted-foreground truncate">{tab.url}</div>
                </div>
                {tab.active && <span className="text-xs text-muted-foreground">(当前)</span>}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
