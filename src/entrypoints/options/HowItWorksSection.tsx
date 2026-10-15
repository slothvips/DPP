import { BookOpen, Server } from 'lucide-react';
import { browser } from 'wxt/browser';
import { Button } from '@/components/ui/button';

export function HowItWorksSection() {
  return (
    <section className="min-w-0 space-y-4 rounded-lg border p-4" data-testid="how-it-works-section">
      <h2 className="text-xl font-semibold">DPP 是如何工作的</h2>
      <p className="text-xs text-muted-foreground">
        DPP
        是一个浏览器侧边工作台：数据先保存在本地，需要时在你的浏览器内端到端加密后，同步到你自己部署的服务器。点开看看数据是怎么流动的，或查看后端部署教程。
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          data-testid="button-open-how-it-works"
          onClick={() =>
            void browser.tabs.create({ url: browser.runtime.getURL('/how-it-works.html') })
          }
          className="flex-1"
        >
          <BookOpen className="mr-2 h-4 w-4" />
          查看工作原理
        </Button>
        <Button
          variant="outline"
          data-testid="button-open-deploy-guide"
          onClick={() =>
            void browser.tabs.create({ url: browser.runtime.getURL('/deploy-guide.html') })
          }
          className="flex-1"
        >
          <Server className="mr-2 h-4 w-4" />
          部署后端教程
        </Button>
      </div>
    </section>
  );
}
