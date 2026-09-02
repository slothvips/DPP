import { ArrowDown, ArrowUp } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useGlobalSync } from '@/hooks/useGlobalSync';
import { cn } from '@/utils/cn';

interface GlobalSyncButtonProps {
  orientation?: 'horizontal' | 'vertical';
}

export function GlobalSyncButton({ orientation = 'horizontal' }: GlobalSyncButtonProps) {
  const { isSyncing, pendingCounts, push, pull } = useGlobalSync();
  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);

  const isAnyOperating = isSyncing || isPushing || isPulling;
  const isVertical = orientation === 'vertical';

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
        'flex rounded-xl bg-background/55 p-0.5 ring-1 ring-border/35 dark:bg-card/78 dark:ring-border/55',
        isVertical ? 'flex-col gap-1' : 'flex-row items-center gap-1'
      )}
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={handlePush}
        disabled={isAnyOperating || pendingCounts.push === 0}
        title={`推送 ${pendingCounts.push} 个本地更改`}
        className={cn(
          'gap-1 rounded-xl px-2',
          isVertical ? 'h-auto w-full justify-start py-2' : 'h-8'
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
          'gap-1 rounded-xl px-2',
          isVertical ? 'h-auto w-full justify-start py-2' : 'h-8'
        )}
      >
        <ArrowDown
          className={cn('h-4 w-4 shrink-0', (isPulling || isSyncing) && 'animate-pulse')}
        />
        <span className="text-xs tabular-nums">{pendingCounts.pull}</span>
        {isVertical && <span className="text-xs">拉取</span>}
      </Button>
    </div>
  );
}
