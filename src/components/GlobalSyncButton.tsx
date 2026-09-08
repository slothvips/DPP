import { ArrowDown, ArrowUp } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useGlobalSync } from '@/hooks/useGlobalSync';
import { cn } from '@/utils/cn';

interface GlobalSyncButtonProps {
  children?: ReactNode;
  orientation?: 'horizontal' | 'vertical';
}

export function GlobalSyncButton({ children, orientation = 'horizontal' }: GlobalSyncButtonProps) {
  const { isSyncing, status, error, pendingCounts, push, pull } = useGlobalSync();
  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);

  const isAnyOperating = isSyncing || isPushing || isPulling;
  const isVertical = orientation === 'vertical';
  const statusLabel = status === 'error' ? '同步失败' : status === 'partial' ? '部分完成' : null;

  const handlePush = async () => {
    setIsPushing(true);
    try {
      await push();
    } finally {
      setIsPushing(false);
    }
  };

  const handlePull = async () => {
    setIsPulling(true);
    try {
      await pull();
    } finally {
      setIsPulling(false);
    }
  };

  return (
    <div
      className={cn(
        'rounded-xl bg-background/55 p-0.5 ring-1 ring-border/35 dark:bg-card/78 dark:ring-border/55',
        isVertical
          ? 'flex flex-col gap-1'
          : `grid w-full ${children ? 'grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]' : 'grid-cols-3'} gap-1`
      )}
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={handlePush}
        disabled={isAnyOperating || pendingCounts.push === 0}
        title={`推送 ${pendingCounts.push} 个本地更改`}
        className={cn(
          'gap-1 rounded-xl px-2 hover:!translate-y-0 active:!translate-y-0 active:!scale-100',
          isVertical ? 'h-auto w-full justify-start py-2' : 'h-8 min-w-0 w-full gap-0.5 px-1'
        )}
      >
        <ArrowUp className={cn('h-4 w-4 shrink-0', (isPushing || isSyncing) && 'animate-pulse')} />
        <span className="text-xs tabular-nums">{pendingCounts.push}</span>
        {isVertical && <span className="text-xs">推送</span>}
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={handlePull}
        disabled={isAnyOperating || pendingCounts.pull === 0}
        title={`拉取 ${pendingCounts.pull} 个远程更改`}
        className={cn(
          'gap-1 rounded-xl px-2 hover:!translate-y-0 active:!translate-y-0 active:!scale-100',
          isVertical ? 'h-auto w-full justify-start py-2' : 'h-8 min-w-0 w-full gap-0.5 px-1'
        )}
      >
        <ArrowDown
          className={cn('h-4 w-4 shrink-0', (isPulling || isSyncing) && 'animate-pulse')}
        />
        <span className="text-xs tabular-nums">{pendingCounts.pull}</span>
        {isVertical && <span className="text-xs">拉取</span>}
      </Button>

      {children}

      {statusLabel && (
        <span
          className={cn(
            'whitespace-nowrap px-1.5 text-xs',
            !isVertical && (children ? 'col-span-4' : 'col-span-3'),
            status === 'error' ? 'text-destructive' : 'text-warning'
          )}
          role="status"
          aria-live="polite"
          title={error || statusLabel}
        >
          {statusLabel}
        </span>
      )}
    </div>
  );
}
