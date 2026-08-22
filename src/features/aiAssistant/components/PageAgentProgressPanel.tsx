import { Check, ChevronDown, CircleAlert, Loader2, Square } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/utils/cn';
import type { PageAgentProgress } from '../hooks/usePageAgentProgress';

interface PageAgentProgressPanelProps {
  progress: PageAgentProgress;
}

function getValueText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.length > 0 ? `${value.length} 项操作` : '暂无详情';
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    for (const key of ['message', 'description', 'action', 'name', 'type', 'text', 'url']) {
      if (typeof record[key] === 'string' && record[key]) return record[key];
    }
    try {
      return JSON.stringify(record);
    } catch {
      return '执行网页操作';
    }
  }
  return '执行网页操作';
}

function getStatusText(status: PageAgentProgress['status']): string {
  if (status === 'completed') return '已完成';
  if (status === 'failed') return '执行失败';
  if (status === 'stopped') return '已停止';
  if (status === 'stopping') return '正在停止';
  return '执行中';
}

export function PageAgentProgressPanel({ progress }: PageAgentProgressPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const isTerminal =
    progress.status === 'completed' ||
    progress.status === 'failed' ||
    progress.status === 'stopped';
  const isFailed = progress.status === 'failed';
  const steps = progress.history.slice(-6);
  const currentText = progress.activity ? getValueText(progress.activity) : '正在准备下一步操作';

  return (
    <section
      className="mb-2 overflow-hidden rounded-xl border border-border/60 bg-background"
      aria-live="polite"
      role="status"
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/35"
        onClick={() => setIsExpanded((expanded) => !expanded)}
        disabled={!isTerminal}
        aria-expanded={isExpanded}
      >
        {isFailed ? (
          <CircleAlert className="h-3.5 w-3.5 shrink-0 text-destructive" />
        ) : isTerminal ? (
          <Check className="h-3.5 w-3.5 shrink-0 text-success" />
        ) : (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-info" />
        )}
        <span className="min-w-0 flex-1 whitespace-normal break-words text-xs font-medium leading-5 text-foreground">
          {getStatusText(progress.status)} · {progress.task}
        </span>
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {progress.history.length} 步
        </span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 text-muted-foreground transition-transform',
            isExpanded && 'rotate-180'
          )}
        />
      </button>

      {isExpanded && (
        <div className="max-h-56 overflow-y-auto border-t border-border/50 px-3 py-2.5 custom-scrollbar">
          {!isTerminal && (
            <div className="flex items-center gap-2 text-[11px] text-info">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-info/10">
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
              </span>
              <span className="whitespace-normal break-words leading-5">{currentText}</span>
            </div>
          )}

          {steps.length > 0 && (
            <ol className={cn('space-y-1.5', !isTerminal && 'mt-2 border-l border-border/60 pl-3')}>
              {steps.map((step, index) => (
                <li
                  key={`${progress.taskId}-${progress.history.length - steps.length + index}`}
                  className="flex min-w-0 items-center gap-2 text-[11px] text-muted-foreground"
                >
                  <Check className="h-3 w-3 shrink-0 text-success" />
                  <span className="whitespace-normal break-words leading-5">
                    {getValueText(step)}
                  </span>
                </li>
              ))}
            </ol>
          )}

          {progress.error && (
            <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-5 text-destructive">
              <Square className="mt-1 h-2.5 w-2.5 shrink-0 fill-current" />
              <span>{progress.error}</span>
            </p>
          )}
          {progress.result?.data && isTerminal && !progress.error && (
            <p className="mt-2 whitespace-pre-wrap break-words text-[11px] leading-5 text-muted-foreground">
              {progress.result.data}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
