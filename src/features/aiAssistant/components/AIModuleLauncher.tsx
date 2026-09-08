import { Pin } from 'lucide-react';
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
  pinnedIds: readonly TabId[];
  pinLimit: number;
  onSelect: (id: TabId) => void;
  onTogglePin: (id: TabId) => void;
}

export function AIModuleLauncher({
  activeId,
  items,
  pinnedIds,
  pinLimit,
  onSelect,
  onTogglePin,
}: AIModuleLauncherProps) {
  return (
    <section
      className="flex w-full flex-col overflow-hidden bg-background text-foreground"
      aria-label="模块入口"
    >
      <div className="flex h-9 shrink-0 items-center border-b border-border/60 px-2">
        <span className="text-sm font-semibold text-foreground">模块</span>
        <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
          已固定 {pinnedIds.length}/{pinLimit}
        </span>
      </div>
      <div className="grid max-h-[min(24rem,calc(100vh-7rem))] auto-rows-[6.5rem] grid-cols-3 content-start gap-2 overflow-y-auto border-b border-border/60 px-2 py-2">
        {items.map((item) => {
          const isPinned = pinnedIds.includes(item.id);
          const pinDisabled = !isPinned && pinnedIds.length >= pinLimit;

          return (
            <div
              key={item.id}
              className={cn(
                'group relative min-w-0 rounded-lg border border-border/55 bg-muted/20 text-center transition-colors hover:border-primary/35 hover:bg-primary/5',
                activeId === item.id && 'border-primary/55 bg-primary/5'
              )}
            >
              <button
                type="button"
                className="flex h-full w-full min-w-0 flex-col items-center justify-center gap-1.5 rounded-lg px-1 py-3 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
              </button>
              <button
                type="button"
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-35"
                onClick={() => onTogglePin(item.id)}
                disabled={pinDisabled}
                aria-pressed={isPinned}
                aria-label={`${isPinned ? '取消固定' : '固定'}模块：${item.label}`}
                title={
                  pinDisabled
                    ? `最多固定 ${pinLimit} 个模块`
                    : isPinned
                      ? '取消固定'
                      : '固定到快捷栏'
                }
              >
                <Pin className={cn('h-3.5 w-3.5', isPinned && 'fill-current')} />
              </button>
              {activeId === item.id && (
                <span className="absolute bottom-0 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full bg-primary" />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
