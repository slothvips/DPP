import { ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DailyNews, NewsSection } from '@/features/hotNews/types';
import { cn } from '@/utils/cn';

interface HotNewsContentProps {
  error: string | null;
  expandedSections: Set<string>;
  loading: boolean;
  news?: DailyNews;
  onRetry: () => void;
  onToggleSection: (source: string) => void;
}

export function HotNewsContent({
  error,
  expandedSections,
  loading,
  news,
  onRetry,
  onToggleSection,
}: HotNewsContentProps) {
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
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="h-4 w-4 mr-2" />
          重试
        </Button>
      </div>
    );
  }

  if (!news || news.sections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
        <p className="text-muted-foreground">暂时没有新闻 ~(世界在这一天这么安静吗🤫?)</p>
        <Button variant="outline" size="sm" onClick={onRetry}>
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
          onToggle={() => onToggleSection(section.source)}
        />
      ))}
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
        <span className="text-muted-foreground shrink-0">{expanded ? '▾' : '▸'}</span>
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
