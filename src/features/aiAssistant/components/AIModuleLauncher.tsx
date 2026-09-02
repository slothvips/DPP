import { ChevronLeft } from 'lucide-react';
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
  activeId?: TabId;
  items: AIModuleItem[];
  onClose: () => void;
  onSelect: (id: TabId) => void;
  className?: string;
}

function getModuleTone(id: TabId): string {
  if (id === 'jenkins') return 'bg-[#d74738] text-white';
  if (id === 'links') return 'bg-[#3e8bd2] text-white';
  if (id === 'totp') return 'bg-[#e6a321] text-white';
  if (id === 'recorder') return 'bg-[#7558b7] text-white';
  if (id === 'hotNews') return 'bg-[#e05b3f] text-white';
  if (id === 'playground') return 'bg-[#38a77a] text-white';
  return 'bg-[#56616b] text-white';
}

export function AIModuleLauncher({
  activeId,
  items,
  onClose,
  onSelect,
  className,
}: AIModuleLauncherProps) {
  return (
    <section
      className={cn(
        'flex h-full min-h-0 w-full flex-col overflow-hidden bg-background text-foreground',
        className
      )}
      aria-label="模块入口"
    >
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border/60 px-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-border/70 bg-muted/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_1px_1px_rgba(0,0,0,0.08)] transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="关闭模块入口"
            title="关闭模块入口"
            onClick={onClose}
          >
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          </button>
          <span className="text-sm font-semibold text-foreground">模块</span>
        </div>
        <span className="text-[10px] text-muted-foreground">{items.length} 项</span>
      </div>
      <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-3 gap-2 overflow-y-auto border-b border-border/60 px-2 py-3">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={cn(
              'group relative flex min-w-0 flex-col items-center justify-center gap-1.5 rounded-md border border-border/70 bg-muted/20 px-1 py-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_1px_2px_rgba(0,0,0,0.08)] transition-colors transition-transform active:scale-95 hover:border-primary/55 hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              activeId === item.id && 'border-primary/70 bg-primary/10 text-foreground'
            )}
            onClick={() => onSelect(item.id)}
            title={item.description}
          >
            <span
              className={cn(
                'relative flex h-12 w-12 shrink-0 items-center justify-center rounded-[15px] border border-black/15 shadow-[0_2px_3px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.35)] transition-transform group-hover:-translate-y-0.5 group-hover:shadow-[0_4px_7px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.4)] [&_svg]:h-6 [&_svg]:w-6',
                getModuleTone(item.id)
              )}
            >
              {item.icon}
              <span className="pointer-events-none absolute inset-x-1 top-1 h-px rounded-full bg-white/45" />
            </span>
            <span className="max-w-full truncate text-[11px] font-medium text-muted-foreground group-hover:text-foreground">
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
