import { ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getAvailableDates } from '@/features/hotNews/api';
import { cn } from '@/utils/cn';
import { HotNewsContent } from './HotNewsContent';
import { useHotNewsView } from './useHotNewsView';

export function HotNewsView() {
  const {
    date,
    error,
    expandedSections,
    handleDateChange,
    handleScroll,
    loadNews,
    loading,
    news,
    scrollContainerRef,
    toggleSection,
  } = useHotNewsView();

  return (
    <div className="flex h-full flex-col gap-2.5 overflow-hidden p-3.5">
      <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-warning/5 p-2.5 ring-1 ring-warning/7">
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl bg-background/76 p-0.75 ring-1 ring-border/40">
            {getAvailableDates().map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => handleDateChange(d.value)}
                className={cn(
                  'rounded-lg px-2.5 py-0.875 text-xs font-medium transition-all duration-200',
                  date === d.value
                    ? 'bg-warning/10 text-foreground ring-1 ring-warning/12'
                    : 'text-muted-foreground hover:bg-background hover:text-foreground'
                )}
              >
                {d.label}
              </button>
            ))}
          </div>
          <span className="hidden text-[10px] text-muted-foreground sm:inline-block">
            每日凌晨刷新
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <a
            href="https://slothvips.github.io/daily-hot-news/"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 rounded-xl px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-background/70 hover:text-primary"
            title="查看更多历史归档"
          >
            <span>查看往日</span>
            <ExternalLink className="h-3 w-3" />
          </a>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-xl text-muted-foreground hover:bg-warning/10 hover:text-warning"
            onClick={loadNews}
            disabled={loading}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto pr-1 custom-scrollbar"
        ref={scrollContainerRef}
        onScroll={handleScroll}
      >
        <HotNewsContent
          error={error}
          expandedSections={expandedSections}
          loading={loading}
          news={news}
          onRetry={loadNews}
          onToggleSection={toggleSection}
        />
      </div>
    </div>
  );
}
