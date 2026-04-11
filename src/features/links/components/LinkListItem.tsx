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
        'flex items-start gap-2 rounded-lg border transition-colors group relative overflow-hidden',
        'p-3 mb-3 min-h-[60px]',
        link.pinnedAt ? 'bg-secondary/30 border-primary/20' : 'hover:bg-accent'
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
            <div className="font-medium truncate text-base leading-normal py-0.5">{link.name}</div>
          </LinkAnchor>
          {import.meta.env.DEV && (
            <div
              className="flex items-center gap-0.5 text-xs text-muted-foreground bg-muted/40 px-1 rounded"
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
            <span className="truncate max-w-[400px] opacity-70 group-hover/link:opacity-100 transition-opacity">
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
