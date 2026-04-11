import { useState } from 'react';
import { type StreamChunk, formatSize } from '@/lib/rrweb-plugins';
import { cn } from '@/utils/cn';
import { NetworkRequestCopyButton } from './NetworkRequestCopyButton';

interface NetworkRequestStreamChunksSectionProps {
  chunks: StreamChunk[];
}

export function NetworkRequestStreamChunksSection({
  chunks,
}: NetworkRequestStreamChunksSectionProps) {
  const [expandedChunks, setExpandedChunks] = useState<Set<number>>(new Set());

  if (chunks.length === 0) {
    return <p className="text-muted-foreground text-xs">暂无流式数据</p>;
  }

  function toggleChunk(index: number) {
    setExpandedChunks((previous) => {
      const next = new Set(previous);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  const totalSize = chunks.reduce((sum, chunk) => sum + chunk.size, 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
        <span>共 {chunks.length} 个数据块</span>
        <span>总大小: {formatSize(totalSize)}</span>
      </div>
      <div className="space-y-1">
        {chunks.map((chunk, index) => {
          const isExpanded = expandedChunks.has(index);
          const previewData =
            chunk.data.length > 100 ? `${chunk.data.slice(0, 100)}...` : chunk.data;
          let displayData = chunk.data;

          try {
            displayData = JSON.stringify(JSON.parse(chunk.data), null, 2);
          } catch {
            // keep raw chunk
          }

          return (
            <div key={index} className="border border-border/50 rounded overflow-hidden">
              <button
                onClick={() => toggleChunk(index)}
                className="w-full flex items-center justify-between p-2 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-muted-foreground">#{index + 1}</span>
                  <span className="text-xs text-muted-foreground">{formatSize(chunk.size)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                    {previewData}
                  </span>
                  <svg
                    className={cn(
                      'w-4 h-4 text-muted-foreground transition-transform',
                      isExpanded && 'rotate-180'
                    )}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </button>
              {isExpanded && (
                <div className="p-2 bg-background relative group">
                  <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <NetworkRequestCopyButton text={chunk.data} />
                  </div>
                  <pre className="text-xs font-mono whitespace-pre-wrap break-all max-h-[300px] overflow-auto">
                    {displayData}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
