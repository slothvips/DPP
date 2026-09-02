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
      className="h-8 w-8 shrink-0 rounded-xl border border-border/55 bg-background/78 text-muted-foreground hover:bg-accent/80 hover:text-accent-foreground"
      aria-label="打开系统设置"
      title="系统设置"
      onClick={openSettings}
    >
      <SlidersHorizontal className="h-4 w-4" />
    </Button>
  );
}
