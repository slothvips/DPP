import { SlidersHorizontal } from 'lucide-react';
import { browser } from 'wxt/browser';
import { Button } from '@/components/ui/button';

export function SystemSettingsButton() {
  function openSettings() {
    void browser.tabs.create({ url: browser.runtime.getURL('/options.html') });
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 shrink-0 rounded-lg border border-border/55 bg-muted/35 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
      aria-label="打开系统设置"
      title="系统设置"
      onClick={openSettings}
    >
      <SlidersHorizontal className="h-4 w-4" />
    </Button>
  );
}
