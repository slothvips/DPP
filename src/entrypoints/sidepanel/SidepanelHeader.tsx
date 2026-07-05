import { Lightbulb } from 'lucide-react';
import { useState } from 'react';
import { GlobalSyncButton } from '@/components/GlobalSyncButton';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { TAB_CONFIG } from './sidepanelTabs';
import type { TabId } from './sidepanelTypes';

interface SidepanelHeaderProps {
  activeTab: TabId;
  showSyncButton: boolean;
}

export function SidepanelHeader({ activeTab, showSyncButton }: SidepanelHeaderProps) {
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const activeTabConfig = TAB_CONFIG[activeTab];
  const { usageGuide } = activeTabConfig;

  return (
    <header className="shrink-0 border-b border-border/45 bg-background/82 px-3 py-2.5 backdrop-blur dark:bg-background/88">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/9 text-primary ring-1 ring-primary/12">
            {activeTabConfig.icon}
          </div>
          <div className="min-w-0">
            <h1
              className="truncate text-sm font-semibold tracking-tight text-foreground"
              data-testid="app-title"
            >
              {activeTabConfig.label}
            </h1>
            <p className="truncate text-xs text-muted-foreground">{activeTabConfig.description}</p>
          </div>
          <Dialog open={isGuideOpen} onOpenChange={setIsGuideOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 rounded-xl border border-border/55 bg-background/78 text-muted-foreground hover:bg-accent/80 hover:text-foreground"
                aria-label="查看使用指南"
                title="查看使用指南"
                data-testid="sidepanel-guide-button"
              >
                <Lightbulb className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[82vh] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-lg border-border/60 bg-background/96 shadow-xl sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>{activeTabConfig.label} 使用指南</DialogTitle>
                <DialogDescription>{usageGuide.summary}</DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-3">
                {usageGuide.sections.map((section) => (
                  <section key={section.title} className="grid gap-2">
                    <h3 className="text-sm font-medium text-foreground">{section.title}</h3>
                    <ul className="grid gap-1.5 text-sm leading-6 text-muted-foreground">
                      {section.items.map((item) => (
                        <li key={item} className="flex gap-2">
                          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {import.meta.env.MODE === 'development' && (
            <span className="rounded-md bg-destructive/10 px-1.5 py-0.5 text-[10px] font-bold text-destructive ring-1 ring-destructive/15">
              DEV
            </span>
          )}
          {showSyncButton && <GlobalSyncButton />}
        </div>
      </div>
    </header>
  );
}
