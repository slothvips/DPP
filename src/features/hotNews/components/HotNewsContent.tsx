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
      <div className="flex h-full items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-background/86 p-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-warning/9 text-warning ring-1 ring-warning/10">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
          <p className="text-sm font-semibold text-foreground">正在加载热榜</p>
          <p className="mt-2 text-xs leading-6 text-muted-foreground">
            稍等片刻，正在整理今天的内容。
          </p>
        </div>
      </div>
    );
  }

  if (error && !news) {
    return (
      <div className="flex h-full items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm rounded-2xl border border-dashed border-warning/16 bg-warning/4 p-6 text-center">
          <p className="text-sm font-semibold text-foreground">加载热榜失败</p>
          <p className="mt-2 text-xs leading-6 text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
            <RefreshCw className="mr-2 h-4 w-4" />
            重试
          </Button>
        </div>
      </div>
    );
  }

  if (!news || news.sections.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm rounded-2xl border border-dashed border-warning/16 bg-warning/4 p-6 text-center">
          <p className="text-sm font-semibold text-foreground">今天还没有热榜内容</p>
          <p className="mt-2 text-xs leading-6 text-muted-foreground">
            暂时没有内容，稍后再来刷新。
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
            <RefreshCw className="mr-2 h-4 w-4" />
            刷新
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-2">
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
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-background/90 shadow-sm transition-all duration-200 hover:border-warning/14 hover:shadow-sm">
      <button
        type="button"
        className="flex w-full items-center gap-2.5 p-3 text-left transition-colors hover:bg-warning/5"
        onClick={onToggle}
      >
        <span className="shrink-0 text-muted-foreground">{expanded ? '▾' : '▸'}</span>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-warning/9 text-base ring-1 ring-warning/10">
          {section.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-foreground">{section.source}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">{section.items.length} 条</div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border/55 px-2 py-1.5">
          <div className="space-y-1.5">
            {section.items.map((item, idx) => (
              <a
                key={item.url}
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="group block rounded-xl px-3 py-2.5 transition-colors hover:bg-warning/4"
              >
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
                    {idx + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-1.5">
                      <span
                        className={cn(
                          'text-sm leading-5.5 text-foreground line-clamp-2',
                          'group-hover:text-primary'
                        )}
                      >
                        {item.title}
                      </span>
                      <ExternalLink className="mt-1 h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-60" />
                    </div>
                    {item.comment && (
                      <p className="mt-0.5 text-xs leading-5.5 text-muted-foreground line-clamp-2">
                        {item.comment}
                      </p>
                    )}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
