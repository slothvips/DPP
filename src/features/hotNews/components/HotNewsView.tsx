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
    <div className="space-y-2 h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="flex bg-muted rounded-md p-0.5">
            {getAvailableDates().map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => handleDateChange(d.value)}
                className={cn(
                  'px-2.5 py-1 text-xs font-medium rounded-sm transition-all',
                  date === d.value
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {d.label}
              </button>
            ))}
          </div>
          <span className="text-[10px] text-muted-foreground hidden sm:inline-block">
            每日凌晨刷新
          </span>
        </div>
        <div className="flex items-center gap-1">
          <a
            href="https://slothvips.github.io/daily-hot-news/"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-muted-foreground hover:text-primary flex items-center gap-0.5 px-2 transition-colors"
            title="查看更多历史归档"
          >
            <span>查看往日</span>
            <ExternalLink className="h-3 w-3" />
          </a>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={loadNews}
            disabled={loading}
          >
            <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-1" ref={scrollContainerRef} onScroll={handleScroll}>
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
