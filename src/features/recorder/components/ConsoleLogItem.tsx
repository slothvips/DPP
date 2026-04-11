import { useMemo, useState } from 'react';
import { FormattedArgs } from '@/features/recorder/components/ConsoleFormattedValue';
import {
  type ConsoleLogWithTimestamp,
  EXPAND_CONTENT_THRESHOLD,
  type LogStatus,
  getLogBackground,
} from '@/features/recorder/components/consolePanelShared';
import { formatClonedValue, getLevelColor, getLevelIcon } from '@/lib/rrweb-plugins';
import { cn } from '@/utils/cn';

interface ConsoleLogItemProps {
  log: ConsoleLogWithTimestamp;
  status: LogStatus;
  timeLabel: string;
}

export function ConsoleLogItem({ log, status, timeLabel }: ConsoleLogItemProps) {
  const [showStack, setShowStack] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const isFuture = status === 'future';
  const isActive = status === 'active';
  const hasStack = Boolean(log.stack) && (log.level === 'error' || log.level === 'trace');

  const formattedContent = useMemo(() => {
    return log.args.map((arg) => formatClonedValue(arg)).join(' ');
  }, [log.args]);

  const needsExpand =
    formattedContent.length > EXPAND_CONTENT_THRESHOLD || formattedContent.includes('\n');

  return (
    <div
      className={cn(
        'px-2 py-1.5 transition-colors',
        isActive && 'bg-blue-500/20 dark:bg-blue-500/30 border-l-2 border-l-blue-500',
        isFuture && 'opacity-40',
        !isFuture && !isActive && getLogBackground(log.level)
      )}
    >
      <div className="flex items-start gap-2">
        <span
          className={cn(
            'flex-shrink-0 w-4 text-center',
            isFuture ? 'text-muted-foreground' : getLevelColor(log.level)
          )}
          title={log.level}
        >
          {getLevelIcon(log.level)}
        </span>

        <span className="flex-shrink-0 font-mono text-xs text-muted-foreground">{timeLabel}</span>

        <div className="flex-1 min-w-0">
          <div
            className={cn(
              'font-mono text-xs break-all',
              isFuture && 'text-muted-foreground',
              !expanded && needsExpand && 'line-clamp-3'
            )}
          >
            <FormattedArgs args={log.args} isFuture={isFuture} expanded={expanded} />
          </div>

          {needsExpand && (
            <button
              onClick={() => setExpanded((value) => !value)}
              className="text-xs text-primary hover:text-primary/80 mt-1"
            >
              {expanded ? '收起' : '展开全部'}
            </button>
          )}

          {hasStack && (
            <div className="mt-1">
              <button
                onClick={() => setShowStack((value) => !value)}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <svg
                  className={cn('w-3 h-3 transition-transform', showStack && 'rotate-90')}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
                <span>调用栈</span>
              </button>
              {showStack && (
                <pre className="mt-1 p-2 text-xs font-mono bg-muted/50 rounded overflow-x-auto text-muted-foreground">
                  {log.stack}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
