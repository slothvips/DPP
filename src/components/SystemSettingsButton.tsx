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
      className="h-8 w-8 shrink-0 hover:!translate-y-0 active:!translate-y-0 active:!scale-100"
      aria-label="打开系统设置"
      title="系统设置"
      onClick={openSettings}
    >
      <SlidersHorizontal className="h-4 w-4" />
    </Button>
  );
}
