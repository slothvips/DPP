import { ExternalLink, Play, Shield } from 'lucide-react';
import type { RecentAction } from '@/db';
import { cn } from '@/utils/cn';

interface RecentActionsProps {
  actions: RecentAction[];
  onReplay: (action: RecentAction) => Promise<void>;
}

function getActionIcon(type: RecentAction['type']) {
  if (type === 'link_visit') return <ExternalLink className="h-3.5 w-3.5" />;
  if (type === 'jenkins_build') return <Play className="h-3.5 w-3.5" />;
  return <Shield className="h-3.5 w-3.5" />;
}

function getActionVerb(type: RecentAction['type']): string {
  if (type === 'link_visit') return '打开链接';
  if (type === 'jenkins_build') return '构建任务';
  return '复制验证码';
}

export function RecentActions({ actions, onReplay }: RecentActionsProps) {
  if (actions.length === 0) return null;

  return (
    <section className="mx-auto mt-7 w-full max-w-xl text-left" aria-label="最近使用">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-xs font-medium text-muted-foreground">最近使用</h2>
        <span className="text-[10px] text-muted-foreground/70">点击即可再次执行</span>
      </div>
      <div className="overflow-hidden rounded-xl border border-border/60 bg-background/75">
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            className={cn(
              'group flex w-full min-w-0 items-center gap-2.5 border-b border-border/50 px-3 py-2.5 text-left last:border-b-0',
              'hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring'
            )}
            onClick={() => void onReplay(action)}
            title={`再次${getActionVerb(action.type)}`}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted/70 text-primary group-hover:bg-primary group-hover:text-primary-foreground">
              {getActionIcon(action.type)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium text-foreground">
                {getActionVerb(action.type)}
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">
                {action.label}
              </span>
            </span>
            <span className="shrink-0 text-[10px] text-muted-foreground/60">
              {new Date(action.lastUsedAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
