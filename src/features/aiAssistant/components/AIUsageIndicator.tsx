import { Database, Gauge } from 'lucide-react';
import type { TokenUsage } from '@/lib/ai/types';

interface AIUsageIndicatorProps {
  usage?: TokenUsage;
}

function formatTokens(tokens: number): string {
  if (tokens < 1_000) {
    return String(tokens);
  }
  if (tokens < 1_000_000) {
    return `${(tokens / 1_000).toFixed(tokens < 10_000 ? 1 : 0)}K`;
  }
  return `${(tokens / 1_000_000).toFixed(1)}M`;
}

export function AIUsageIndicator({ usage }: AIUsageIndicatorProps) {
  if (!usage) {
    return null;
  }

  const contextPercentage = usage.contextWindow
    ? Math.min(100, (usage.inputTokens / usage.contextWindow) * 100)
    : null;
  const cacheHitRate =
    usage.cachedInputTokens !== undefined && usage.inputTokens > 0
      ? Math.min(100, (usage.cachedInputTokens / usage.inputTokens) * 100)
      : null;

  return (
    <div
      className="mb-2 flex min-h-6 flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11px] text-muted-foreground"
      title="最近一次模型请求的服务商 usage 数据"
    >
      <div className="flex items-center gap-1.5">
        <Gauge className="h-3.5 w-3.5" />
        <span>上下文</span>
        <span className="font-medium tabular-nums text-foreground/80">
          {formatTokens(usage.inputTokens)}
          {usage.contextWindow ? ` / ${formatTokens(usage.contextWindow)}` : ' tokens'}
        </span>
        {contextPercentage !== null && (
          <>
            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-info transition-[width]"
                style={{ width: `${contextPercentage}%` }}
              />
            </div>
            <span className="tabular-nums">{contextPercentage.toFixed(1)}%</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <Database className="h-3.5 w-3.5" />
        <span>缓存命中</span>
        <span className="font-medium tabular-nums text-foreground/80">
          {cacheHitRate === null ? '--' : `${cacheHitRate.toFixed(1)}%`}
        </span>
      </div>
    </div>
  );
}
