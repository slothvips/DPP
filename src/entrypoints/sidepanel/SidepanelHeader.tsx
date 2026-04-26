import { Settings } from 'lucide-react';
import { browser } from 'wxt/browser';
import { GlobalSyncButton } from '@/components/GlobalSyncButton';
import { Button } from '@/components/ui/button';

interface SidepanelHeaderProps {
  showSyncButton: boolean;
}

export function SidepanelHeader({ showSyncButton }: SidepanelHeaderProps) {
  const openSettings = () => {
    browser.tabs.create({ url: browser.runtime.getURL('/options.html') });
  };

  return (
    <header className="sticky top-0 z-10 border-b border-border/50 bg-background/80 px-3 py-3 backdrop-blur dark:bg-background/88">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/9 text-sm font-semibold text-primary ring-1 ring-primary/12">
            D
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold tracking-tight" data-testid="app-title">
                DPP
              </h1>
              {import.meta.env.MODE === 'development' && (
                <span className="rounded-md bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-destructive-foreground shadow-sm">
                  DEV
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">你的侧边工作台</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {showSyncButton && <GlobalSyncButton />}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-xl border border-transparent bg-background/55 hover:border-border/70 dark:bg-card/78 dark:hover:bg-card"
            onClick={openSettings}
            data-testid="settings-button"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
