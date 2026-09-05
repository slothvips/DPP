import type { ReactNode } from 'react';
import type { TabId } from '@/entrypoints/sidepanel/sidepanelTypes';
import { cn } from '@/utils/cn';

export interface AIModuleItem {
  id: TabId;
  label: string;
  description: string;
  icon: ReactNode;
}

interface AIModuleLauncherProps {
  activeId: TabId;
  items: AIModuleItem[];
  onSelect: (id: TabId) => void;
}

export function AIModuleLauncher({ activeId, items, onSelect }: AIModuleLauncherProps) {
  return (
    <section
      className="flex w-full flex-col overflow-hidden bg-background text-foreground"
      aria-label="模块入口"
    >
      <div className="flex h-9 shrink-0 items-center border-b border-border/60 px-2">
        <span className="text-sm font-semibold text-foreground">模块</span>
      </div>
      <div className="grid max-h-[min(24rem,calc(100vh-7rem))] auto-rows-[6.5rem] grid-cols-3 content-start gap-2 overflow-y-auto border-b border-border/60 px-2 py-2">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={cn(
              'group relative flex min-w-0 flex-col items-center justify-center gap-1.5 rounded-lg border border-border/55 bg-muted/20 px-1 py-3 text-center transition-colors active:scale-95 hover:border-primary/35 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              activeId === item.id && 'border-primary/55 bg-primary/5'
            )}
            onClick={() => onSelect(item.id)}
            title={item.description}
          >
            <span
              className={cn(
                'relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/55 bg-muted/45 text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary [&_svg]:h-5 [&_svg]:w-5',
                activeId === item.id && 'bg-primary/10 text-primary'
              )}
            >
              {item.icon}
            </span>
            <span className="max-w-full truncate text-[11px] font-medium text-foreground">
              {item.label}
            </span>
            {activeId === item.id && (
              <span className="absolute bottom-0 h-0.5 w-4 rounded-full bg-primary" />
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
