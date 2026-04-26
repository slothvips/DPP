import { Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function JenkinsEmptyState() {
  return (
    <div className="flex h-full items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm rounded-3xl border border-border/60 bg-background/88 p-6 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm ring-1 ring-primary/15">
          <Settings2 className="h-6 w-6" />
        </div>
        <p className="text-sm font-semibold text-foreground">请先在设置页配置 Jenkins</p>
        <p className="mt-2 text-xs leading-6 text-muted-foreground">
          配置环境后，就可以在这里查看 Job 和构建记录。
        </p>
        <Button
          variant="outline"
          className="mt-5 rounded-xl"
          onClick={() => browser.tabs.create({ url: browser.runtime.getURL('/options.html') })}
        >
          去设置
        </Button>
      </div>
    </div>
  );
}
