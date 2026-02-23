import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronDown, ChevronRight, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { db } from '@/db';
import { fetchNews, getAvailableDates } from '@/features/hotNews/api';
import type { DailyNews, NewsSection } from '@/features/hotNews/types';
import { cn } from '@/utils/cn';
import { logger } from '@/utils/logger';

export function HotNewsView() {
  const [date, setDate] = useState(getAvailableDates()[0].value);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('dpp_hotnews_expanded');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch (error) {
      logger.debug('Failed to parse expanded sections:', error);
      return new Set();
    }
  });

  const cachedNews = useLiveQuery(() => db.hotNews.get(date), [date]);
  const news = cachedNews?.data as DailyNews | undefined;

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('dpp_hotnews_expanded', JSON.stringify([...expandedSections]));
  }, [expandedSections]);

  useEffect(() => {
    const savedScroll = localStorage.getItem('dpp_hotnews_scroll');
    if (savedScroll && scrollContainerRef.current) {
      requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = Number(savedScroll);
        }
      });
    }
  }, [date, news, expandedSections]);

  const handleScroll = useCallback(() => {
    if (scrollContainerRef.current) {
      localStorage.setItem('dpp_hotnews_scroll', String(scrollContainerRef.current.scrollTop));
    }
  }, []);

  const loadNews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await fetchNews(date);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load news');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    if (!cachedNews) {
      loadNews();
    }
  }, [cachedNews, loadNews]);

  const toggleSection = (source: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(source)) {
        next.delete(source);
      } else {
        next.add(source);
      }
      return next;
    });
  };

  const renderContent = () => {
    if (loading && !news) {
      return (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (error && !news) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
          <p className="text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={loadNews}>
            <RefreshCw className="h-4 w-4 mr-2" />
            重试
          </Button>
        </div>
      );
    }

    if (!news || news.sections.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
          <p className="text-muted-foreground">暂时没有新闻~(世界在这一天这么安静吗🤫?)</p>
          <Button variant="outline" size="sm" onClick={loadNews}>
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {news.sections.map((section) => (
          <SectionCard
            key={section.source}
            section={section}
            expanded={expandedSections.has(section.source)}
            onToggle={() => toggleSection(section.source)}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-2 h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="flex bg-muted rounded-md p-0.5">
            {getAvailableDates().map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => {
                  setDate(d.value);
                  setExpandedSections(new Set());
                }}
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
          <span className="text-[10px] text-muted-foreground/60 hidden sm:inline-block">
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
        {renderContent()}
      </div>
    </div>
  );
}

interface SectionCardProps {
  section: NewsSection;
  expanded: boolean;
  onToggle: () => void;
}

function SectionCard({ section, expanded, onToggle }: SectionCardProps) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center gap-2 p-3 hover:bg-accent transition-colors text-left"
        onClick={onToggle}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <span className="text-lg">{section.icon}</span>
        <span className="font-medium text-sm truncate flex-1">{section.source}</span>
        <span className="text-xs text-muted-foreground">{section.items.length}</span>
      </button>

      {expanded && (
        <div className="border-t divide-y">
          {section.items.map((item, idx) => (
            <a
              key={item.url}
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="block p-3 hover:bg-accent transition-colors group"
            >
              <div className="flex items-start gap-2">
                <span className="text-xs text-muted-foreground shrink-0 mt-0.5">{idx + 1}.</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className={cn('text-sm line-clamp-2', 'group-hover:text-primary')}>
                      {item.title}
                    </span>
                    <ExternalLink className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-50 transition-opacity" />
                  </div>
                  {item.comment && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {item.comment}
                    </p>
                  )}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
