import {
  Check,
  Clock,
  Copy,
  Edit,
  List,
  Pin,
  PinOff,
  Plus,
  Search,
  StickyNote,
  Trash2,
} from 'lucide-react';
import { type AnchorHTMLAttributes, type MouseEvent, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/components/ui/toast';
import type { LinkItem, TagItem } from '@/db';
import { LinkDialog } from '@/features/links/components/LinkDialog';
import { type LinkWithStats, useLinks } from '@/features/links/hooks/useLinks';
import { cn } from '@/utils/cn';

type ViewMode = 'recent' | 'all';

function NoteButton({ note }: { note: string }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(note);
    setCopied(true);
    toast('备注已复制', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={(e) => {
            e.stopPropagation();
          }}
          title="查看备注"
        >
          <StickyNote className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b">
            <span className="text-xs font-medium text-muted-foreground">备注</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleCopy}
              title="复制"
            >
              {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>
          <div className="p-3 text-sm whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto">
            {note}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function LinkWithCopy({
  href,
  children,
  className,
  target,
  onSingleClick,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { onSingleClick?: () => void }) {
  const { toast } = useToast();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      navigator.clipboard.writeText(href || '').then(
        () => toast('链接已复制', 'success'),
        () => toast('复制失败', 'error')
      );
    } else {
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (onSingleClick) onSingleClick();
        if (href) window.open(href, target || '_self');
      }, 250);
    }
  };

  return (
    <a href={href} onClick={handleClick} className={className} target={target} {...props}>
      {children}
    </a>
  );
}

export function LinksView() {
  const { links, recordVisit, togglePin, addLink, updateLink, deleteLink } = useLinks();
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<(LinkItem & { tags?: TagItem[] }) | null>(null);
  const { toast } = useToast();

  const filteredAndSortedLinks = useMemo(() => {
    if (!links) return [];

    const result = [...links];

    if (search) {
      // Split search text into multiple keywords (支持多关键词搜索)
      const keywords = search
        .toLowerCase()
        .split(' ')
        .filter((k) => k.trim().length > 0);

      if (keywords.length === 0) {
        // If no valid keywords, skip filtering
        return result;
      }

      return result
        .filter((l) => {
          const name = l.name.toLowerCase();
          const url = l.url.toLowerCase();
          const tagNames = l.tags?.map((t) => t.name.toLowerCase()) || [];

          // All keywords must match (AND logic)
          return keywords.every(
            (kw) =>
              name.includes(kw) || url.includes(kw) || tagNames.some((tag) => tag.includes(kw))
          );
        })
        .sort((a, b) => {
          const aPinned = !!a.pinnedAt;
          const bPinned = !!b.pinnedAt;
          if (aPinned !== bPinned) return aPinned ? -1 : 1;
          if (a.pinnedAt && b.pinnedAt) {
            return (b.pinnedAt || 0) - (a.pinnedAt || 0);
          }
          return b.usageCount - a.usageCount;
        });
    }

    switch (viewMode) {
      case 'recent':
        return result.filter((l) => l.lastUsedAt > 0).sort((a, b) => b.lastUsedAt - a.lastUsedAt);
      default:
        return result.sort((a, b) => {
          const aPinned = !!a.pinnedAt;
          const bPinned = !!b.pinnedAt;
          if (aPinned !== bPinned) return aPinned ? -1 : 1;
          if (a.pinnedAt && b.pinnedAt) {
            return (b.pinnedAt || 0) - (a.pinnedAt || 0);
          }
          if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount;
          return a.name.localeCompare(b.name);
        });
    }
  }, [links, search, viewMode]);

  const handleLinkClick = (id: string) => {
    recordVisit(id).catch(() => {
      // Visit recording failure is non-critical - link still opens
    });
  };

  const handleAdd = () => {
    setEditingLink(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (link: LinkWithStats) => {
    setEditingLink(link);
    setIsDialogOpen(true);
  };

  const handleDelete = async (link: LinkItem) => {
    if (confirm(`确定要删除 "${link.name}" 吗？`)) {
      try {
        await deleteLink(link.id);
        toast('删除成功', 'success');
      } catch {
        toast('删除失败', 'error');
      }
    }
  };

  const handleSave = async (
    data: Omit<LinkItem, 'id' | 'updatedAt' | 'category'> & { tags?: string[] }
  ) => {
    try {
      if (editingLink) {
        await updateLink(editingLink.id, data);
        toast('更新成功', 'success');
      } else {
        await addLink(data);
        toast('添加成功', 'success');
      }
      setIsDialogOpen(false);
    } catch {
      toast('保存失败', 'error');
    }
  };

  return (
    <div className="space-y-4 h-full flex flex-col overflow-hidden">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索链接..."
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button onClick={handleAdd} size="icon" className="shrink-0" title="添加链接">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {!search && (
          <div className="flex border-b">
            <button
              type="button"
              className={cn(
                'flex-1 py-2 text-sm font-medium transition-colors relative',
                viewMode === 'recent'
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => setViewMode('recent')}
            >
              <div className="flex items-center justify-center gap-1">
                <Clock className="h-4 w-4" />
                <span>Recent</span>
              </div>
              {viewMode === 'recent' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
            <button
              type="button"
              className={cn(
                'flex-1 py-2 text-sm font-medium transition-colors relative',
                viewMode === 'all' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => setViewMode('all')}
            >
              <div className="flex items-center justify-center gap-1">
                <List className="h-4 w-4" />
                <span>All</span>
              </div>
              {viewMode === 'all' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
          </div>
        )}
      </div>

      <div className="grid gap-2 overflow-y-auto pr-1 pb-2 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
        {filteredAndSortedLinks?.map((link) => (
          <div
            key={link.id}
            className={cn(
              'flex items-center gap-2 p-3 rounded-lg border transition-colors group relative overflow-hidden',
              link.pinnedAt ? 'bg-secondary/30 border-primary/20' : 'hover:bg-accent'
            )}
          >
            <LinkWithCopy
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="flex-1 min-w-0"
              onSingleClick={() => handleLinkClick(link.id)}
              onAuxClick={(e) => {
                if (e.button === 1) {
                  handleLinkClick(link.id);
                }
              }}
            >
              <div className="flex items-center gap-2">
                <div className="font-medium truncate">{link.name}</div>
                {link.note && <StickyNote className="h-3 w-3 text-muted-foreground/50 shrink-0" />}
              </div>
              <div className="text-xs text-muted-foreground truncate flex items-center gap-2 mt-0.5">
                <span className="truncate max-w-[200px]">{link.url}</span>
                {link.tags && link.tags.length > 0 && (
                  <div className="flex gap-1">
                    <span className="shrink-0 opacity-50">•</span>
                    {link.tags.map((tag) => (
                      <span
                        key={tag.id}
                        className="bg-muted px-1 rounded text-[10px] text-muted-foreground"
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </LinkWithCopy>

            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-background/80 backdrop-blur-sm p-1 rounded-md shadow-sm border shrink-0">
              {link.note && <NoteButton note={link.note} />}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  togglePin(link.id);
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
                onClick={(e) => {
                  e.stopPropagation();
                  handleEdit(link);
                }}
                title="编辑"
              >
                <Edit className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 text-destructive hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(link);
                }}
                title="删除"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            {link.pinnedAt && (
              <div className="absolute top-0 right-0 p-1 opacity-100 group-hover:opacity-0 group-focus-within:opacity-0 transition-opacity pointer-events-none">
                <Pin className="h-3 w-3 text-primary/50 rotate-45" />
              </div>
            )}
          </div>
        ))}
        {filteredAndSortedLinks?.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            {search
              ? 'No matching links found'
              : viewMode === 'recent'
                ? 'No recently used links yet'
                : 'No links found'}
          </div>
        )}
      </div>

      <LinkDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        initialData={editingLink}
        onSave={handleSave}
      />
    </div>
  );
}
