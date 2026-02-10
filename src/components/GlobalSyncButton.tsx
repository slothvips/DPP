import { ArrowDown, ArrowUp } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useGlobalSync } from '@/hooks/useGlobalSync';
import { cn } from '@/utils/cn';

export function GlobalSyncButton() {
  const { isSyncing, error, pendingCounts, push, pull } = useGlobalSync();
  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);

  const isAnyOperating = isSyncing || isPushing || isPulling;

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
    <div className="flex items-center gap-1">
      {error && (
        <span className="text-xs text-destructive hidden sm:inline-block" title={error}>
          同步失败
        </span>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={handlePush}
        disabled={isAnyOperating || pendingCounts.push === 0}
        title={`推送 ${pendingCounts.push} 个本地更改`}
        className="h-8 px-2 gap-1"
      >
        <ArrowUp className={cn('w-4 h-4', (isPushing || isSyncing) && 'animate-pulse')} />
        <span className="text-xs tabular-nums">{pendingCounts.push}</span>
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={handlePull}
        disabled={isAnyOperating || pendingCounts.pull === 0}
        title={`拉取 ${pendingCounts.pull} 个远程更改`}
        className="h-8 px-2 gap-1"
      >
        <ArrowDown className={cn('w-4 h-4', (isPulling || isSyncing) && 'animate-pulse')} />
        <span className="text-xs tabular-nums">{pendingCounts.pull}</span>
      </Button>
    </div>
  );
}
