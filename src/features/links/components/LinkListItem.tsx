import { Edit, Eye, Pin, PinOff, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { type LinkItem, type TagItem } from '@/db';
import { LinkAnchor } from '@/features/links/components/LinkAnchor';
import { LinkNoteButton } from '@/features/links/components/LinkNoteButton';
import { LinkTagSelector } from '@/features/links/components/LinkTagSelector';
import type { LinkWithStats } from '@/features/links/hooks/useLinks';
import { cn } from '@/utils/cn';

interface LinkListItemProps {
  availableTags: TagItem[];
  link: LinkWithStats;
  onDelete: (link: LinkItem) => void | Promise<void>;
  onEdit: (link: LinkWithStats) => void;
  onRecordVisit: (id: string) => void | Promise<void>;
  onTogglePin: (id: string) => void | Promise<void>;
}

export function LinkListItem({
  availableTags,
  link,
  onDelete,
  onEdit,
  onRecordVisit,
  onTogglePin,
}: LinkListItemProps) {
  return (
    <div
      key={link.id}
      className={cn(
        'group relative mb-2.5 flex min-h-[68px] items-start gap-3 overflow-hidden rounded-2xl border border-border/60 p-3 shadow-sm transition-all duration-200',
        link.pinnedAt
          ? 'bg-primary/4 ring-1 ring-primary/12'
          : 'bg-background/90 hover:border-primary/10 hover:bg-muted/16 hover:shadow-sm'
      )}
    >
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <LinkAnchor
            href={link.url}
            target="_blank"
            rel="noreferrer"
            className={cn('block group/link')}
            onSingleClick={() => onRecordVisit(link.id)}
          >
            <div className="truncate py-0.5 text-sm font-semibold leading-normal text-foreground transition-colors group-hover/link:text-primary">
              {link.name}
            </div>
          </LinkAnchor>
          {import.meta.env.DEV && (
            <div
              className="flex items-center gap-0.5 rounded-md bg-muted/32 px-1.5 py-0.5 text-[11px] text-muted-foreground"
              title={`使用次数：${link.usageCount}`}
            >
              <Eye className="h-3 w-3" />
              <span>{link.usageCount}</span>
            </div>
          )}
          <div className="flex items-center gap-1 ml-auto shrink-0">
            {link.note && <LinkNoteButton note={link.note} />}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={(event) => {
                event.stopPropagation();
                onTogglePin(link.id);
              }}
              title={link.pinnedAt ? '取消置顶' : '置顶'}
            >
              {link.pinnedAt ? (
                <PinOff className="h-3.5 w-3.5" />
              ) : (
                <Pin className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={(event) => {
                event.stopPropagation();
                onEdit(link);
              }}
              title="编辑"
            >
              <Edit className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0 text-destructive hover:text-destructive"
              onClick={(event) => {
                event.stopPropagation();
                onDelete(link);
              }}
              title="删除"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <LinkAnchor
          href={link.url}
          target="_blank"
          rel="noreferrer"
          className={cn('block group/link')}
          onSingleClick={() => onRecordVisit(link.id)}
        >
          <div
            className={cn(
              'text-xs text-muted-foreground truncate flex items-center gap-2',
              'w-full'
            )}
          >
            <span className="max-w-[400px] truncate transition-opacity group-hover/link:opacity-100">
              {link.url}
            </span>
          </div>
        </LinkAnchor>

        <div onClick={(event) => event.stopPropagation()}>
          <LinkTagSelector
            linkId={link.id}
            selectedTagIds={new Set(link.tags?.map((tag: TagItem) => tag.id))}
            availableTags={availableTags}
          />
        </div>
      </div>
    </div>
  );
}
