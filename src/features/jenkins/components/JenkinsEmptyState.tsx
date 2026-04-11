import { Button } from '@/components/ui/button';

export function JenkinsEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-64 space-y-4">
      <p className="text-muted-foreground">请先在设置页配置 Jenkins</p>
      <Button
        variant="outline"
        onClick={() => browser.tabs.create({ url: browser.runtime.getURL('/options.html') })}
      >
        去设置
      </Button>
    </div>
  );
}
