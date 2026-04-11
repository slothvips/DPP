import { VirtualTable } from '@/components/ui/virtual-table';
import {
  type NetworkRequestWithTimestamp,
  formatTimePoint,
  getPhaseIndicator,
  getRequestStatus,
} from '@/features/recorder/components/networkPanelShared';
import { formatDuration, formatSize, getMethodColor, getStatusColor } from '@/lib/rrweb-plugins';
import { cn } from '@/utils/cn';

interface NetworkRequestListProps {
  requests: NetworkRequestWithTimestamp[];
  currentTime?: number;
  recordingStartTime: number;
  selectedRequestId?: string;
  onSelectRequest: (request: NetworkRequestWithTimestamp) => void;
}

function getRequestPath(url: string): string {
  try {
    return new URL(url, 'http://localhost').pathname;
  } catch {
    return url;
  }
}

export function NetworkRequestList({
  requests,
  currentTime,
  recordingStartTime,
  selectedRequestId,
  onSelectRequest,
}: NetworkRequestListProps) {
  return (
    <VirtualTable
      items={requests}
      estimateSize={40}
      overscan={10}
      containerClassName="h-full"
      rowClassName="border-b border-border/50"
      renderRow={(request) => {
        const status = getRequestStatus(request, currentTime, recordingStartTime);
        const isFuture = status === 'future';
        const isActive = status === 'active';

        return (
          <div
            onClick={() => onSelectRequest(request)}
            className={cn(
              'grid grid-cols-[1fr_50px_45px_70px_60px] items-center cursor-pointer transition-colors px-2 py-2',
              selectedRequestId === request.id && 'bg-muted',
              isActive && 'bg-info/20 dark:bg-info/30 border-l-2 border-l-info',
              isFuture && 'opacity-40',
              !isFuture && !isActive && 'hover:bg-muted/50',
              request.error && !isFuture && 'bg-destructive/10 dark:bg-destructive/20',
              request.isStreaming &&
                request.phase !== 'complete' &&
                'bg-console-debug/10 dark:bg-console-debug/20'
            )}
          >
            <div
              className={cn('truncate text-xs', isFuture && 'text-muted-foreground')}
              title={request.url}
            >
              <div className="flex items-center gap-1">
                {request.isStreaming && (
                  <span className="text-console-debug text-xs" title="流式响应">
                    ⚡
                  </span>
                )}
                {request.type === 'sse' && (
                  <span className="text-warning text-xs" title="SSE">
                    📡
                  </span>
                )}
                <span className="truncate">{getRequestPath(request.url)}</span>
              </div>
            </div>
            <div
              className={cn(
                'font-mono text-xs',
                isFuture ? 'text-muted-foreground' : getMethodColor(request.method)
              )}
            >
              {request.method}
            </div>
            <div
              className={cn(
                'font-mono text-xs',
                isFuture ? 'text-muted-foreground' : getStatusColor(request.status)
              )}
            >
              {isFuture
                ? '-'
                : request.status || (request.error ? 'ERR' : getPhaseIndicator(request.phase))}
            </div>
            <div className="font-mono text-xs text-muted-foreground">
              {formatTimePoint(request.eventTimestamp, recordingStartTime)}
            </div>
            <div className="text-right text-xs text-muted-foreground">
              {isFuture
                ? '-'
                : request.isStreaming && request.receivedBytes !== undefined
                  ? formatSize(request.receivedBytes)
                  : formatDuration(request.duration)}
            </div>
          </div>
        );
      }}
    />
  );
}
