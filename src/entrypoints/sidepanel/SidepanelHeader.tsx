import { Settings } from 'lucide-react';
import { browser } from 'wxt/browser';
import { GlobalSyncButton } from '@/components/GlobalSyncButton';
import { Tips } from '@/components/Tips';
import { Button } from '@/components/ui/button';

interface SidepanelHeaderProps {
  showSyncButton: boolean;
}

export function SidepanelHeader({ showSyncButton }: SidepanelHeaderProps) {
  const openSettings = () => {
    browser.tabs.create({ url: browser.runtime.getURL('/options.html') });
  };

  return (
    <header className="flex items-center justify-between p-4 border-b">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-bold" data-testid="app-title">
          DPP
        </h1>
        {import.meta.env.MODE === 'development' && (
          <span className="px-1.5 py-0.5 text-xs font-bold text-destructive-foreground bg-destructive rounded">
            DEV
          </span>
        )}
      </div>
      <Tips />
      <div className="flex items-center gap-1">
        {showSyncButton && <GlobalSyncButton />}
        <Button variant="ghost" size="icon" onClick={openSettings} data-testid="settings-button">
          <Settings className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
}
