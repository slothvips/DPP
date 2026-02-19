import { useLiveQuery } from 'dexie-react-hooks';
import { Bot, Edit, Eye, Pin, PinOff, Plus, Search, StickyNote, Trash2 } from 'lucide-react';
import { type AnchorHTMLAttributes, type MouseEvent, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { type LinkItem, type TagItem, db } from '@/db';
import { ImportLinksDialog } from '@/features/links/components/ImportLinksDialog';
import { LinkDialog } from '@/features/links/components/LinkDialog';
import { LinkTagSelector } from '@/features/links/components/LinkTagSelector';
import { type LinkWithStats, useLinks } from '@/features/links/hooks/useLinks';
import { cn } from '@/utils/cn';
import { useConfirmDialog } from '@/utils/confirm-dialog';
import { logger } from '@/utils/logger';

type SortOption = 'createdAt' | 'updatedAt' | 'usageCount' | 'lastUsedAt';

function NoteButton({ note }: { note: string }) {
  const [open, setOpen] = useState(false);

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
}: AnchorHTMLAttributes<HTMLAnchorElement> & { onSingleClick?: () => void | Promise<void> }) {
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
      timerRef.current = setTimeout(async () => {
        timerRef.current = null;
        if (onSingleClick) await onSingleClick();
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
  const allTags = useLiveQuery(() => db.tags.filter((t) => !t.deletedAt).toArray()) || [];
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('createdAt');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<(LinkItem & { tags?: TagItem[] }) | null>(null);
  const { toast } = useToast();
  const { confirm } = useConfirmDialog();

  const filteredAndSortedLinks = useMemo(() => {
    if (!links) return [];

    let result = [...links];

    if (search) {
      // Split search text into multiple keywords (支持多关键词搜索)
      const keywords = search
        .toLowerCase()
        .split(' ')
        .filter((k) => k.trim().length > 0);

      if (keywords.length > 0) {
        result = result.filter((l) => {
          const name = l.name.toLowerCase();
          const url = l.url.toLowerCase();
          const tagNames = l.tags?.map((t) => t.name.toLowerCase()) || [];

          // All keywords must match (AND logic)
          return keywords.every(
            (kw) =>
              name.includes(kw) || url.includes(kw) || tagNames.some((tag) => tag.includes(kw))
          );
        });
      }
    }

    return result.sort((a, b) => {
      const aPinned = !!a.pinnedAt;
      const bPinned = !!b.pinnedAt;
      if (aPinned !== bPinned) return aPinned ? -1 : 1;
      if (a.pinnedAt && b.pinnedAt) {
        return (b.pinnedAt || 0) - (a.pinnedAt || 0);
      }

      switch (sortBy) {
        case 'usageCount':
          if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount;
          break;
        case 'lastUsedAt': {
          const la = a.lastUsedAt || 0;
          const lb = b.lastUsedAt || 0;
          if (lb !== la) return lb - la;
          break;
        }
        case 'updatedAt':
          if (b.updatedAt !== a.updatedAt) return b.updatedAt - a.updatedAt;
          break;
        case 'createdAt': {
          const ca = a.createdAt || a.updatedAt || 0;
          const cb = b.createdAt || b.updatedAt || 0;
          if (cb !== ca) return cb - ca;
          break;
        }
        default:
          break;
      }

      return a.name.localeCompare(b.name);
    });
  }, [links, search, sortBy]);

  const handleLinkClick = async (id: string) => {
    try {
      await recordVisit(id);
    } catch (e) {
      logger.error('Failed to record visit:', e);
      toast('记录访问失败', 'error');
    }
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
    const confirmed = await confirm(`确定要删除 "${link.name}" 吗？`, '确认删除', 'danger');
    if (confirmed) {
      try {
        await deleteLink(link.id);
        toast('删除成功', 'success');
      } catch {
        toast('删除失败', 'error');
      }
    }
  };

  const handleSave = async (
    data: Omit<LinkItem, 'id' | 'updatedAt' | 'category' | 'createdAt'> & { tags?: string[] }
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
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存失败';
      toast(message, 'error');
    }
  };

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索链接..."
            className="pl-8 h-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
          <SelectTrigger className="w-[140px] shrink-0 h-8 text-xs">
            <SelectValue placeholder="排序方式" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="createdAt" className="text-xs">
              按添加时间
            </SelectItem>
            <SelectItem value="updatedAt" className="text-xs">
              按更新时间
            </SelectItem>
            <SelectItem value="usageCount" className="text-xs">
              按使用次数
            </SelectItem>
            <SelectItem value="lastUsedAt" className="text-xs">
              按上次使用
            </SelectItem>
          </SelectContent>
        </Select>
        <Button
          onClick={() => setIsImportDialogOpen(true)}
          variant="ghost"
          size="sm"
          className="shrink-0 h-8 w-8 p-0"
          title="智能导入"
        >
          <Bot className="h-4 w-4 text-blue-500" />
        </Button>
        <Button onClick={handleAdd} size="sm" className="shrink-0 h-8 w-8 p-0" title="添加链接">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div
        className={cn(
          'grid gap-2 overflow-y-auto pr-1 pb-2 [&::-webkit-scrollbar]:hidden [scrollbar-width:none] flex-1 min-h-0',
          'grid-cols-1 auto-rows-min'
        )}
      >
        {filteredAndSortedLinks?.map((link) => (
          <div
            key={link.id}
            className={cn(
              'flex items-start gap-2 rounded-lg border transition-colors group relative overflow-hidden',
              'p-3 h-auto min-h-[60px]',
              link.pinnedAt ? 'bg-secondary/30 border-primary/20' : 'hover:bg-accent'
            )}
          >
            <div className="flex-1 min-w-0 flex flex-col gap-1.5">
              <LinkWithCopy
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className={cn('block group/link')}
                onSingleClick={() => handleLinkClick(link.id)}
                onAuxClick={(e) => {
                  if (e.button === 1) {
                    handleLinkClick(link.id);
                  }
                }}
              >
                <div className="flex items-center gap-2">
                  <div className="font-medium truncate text-base leading-normal py-0.5">
                    {link.name}
                  </div>
                  {link.note && (
                    <StickyNote className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                  )}
                  {import.meta.env.DEV && link.usageCount >= 0 && (
                    <div
                      className="flex items-center gap-0.5 text-xs text-muted-foreground/50 bg-muted/30 px-1 rounded"
                      title={`使用次数: ${link.usageCount}`}
                    >
                      <Eye className="h-3 w-3" />
                      <span>{link.usageCount}</span>
                    </div>
                  )}
                </div>
                <div
                  className={cn(
                    'text-xs text-muted-foreground truncate flex items-center gap-2 mt-0.5',
                    'w-full'
                  )}
                >
                  <span className="truncate max-w-[400px] opacity-70 group-hover/link:opacity-100 transition-opacity">
                    {link.url}
                  </span>
                </div>
              </LinkWithCopy>

              <div>
                <LinkTagSelector
                  linkId={link.id}
                  selectedTagIds={new Set(link.tags?.map((t) => t.id))}
                  availableTags={allTags}
                />
              </div>
            </div>

            <div
              className={cn(
                'opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-background/90 backdrop-blur-sm p-1 rounded-md shadow-sm border shrink-0 z-10',
                'absolute top-2 right-2'
              )}
            >
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
              <div className="absolute top-0 right-0 p-1 opacity-100 pointer-events-none">
                <div className="bg-primary/10 p-1 rounded-bl-lg backdrop-blur-[1px]">
                  <Pin className="h-3 w-3 text-primary/70 rotate-0" />
                </div>
              </div>
            )}
          </div>
        ))}
        {filteredAndSortedLinks?.length === 0 && (
          <div className="text-center py-8 text-muted-foreground col-span-full">
            {search ? '未找到匹配的链接' : '暂无链接'}
          </div>
        )}
      </div>

      <LinkDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        initialData={editingLink}
        onSave={handleSave}
      />

      <ImportLinksDialog
        isOpen={isImportDialogOpen}
        onClose={() => setIsImportDialogOpen(false)}
        onImportSuccess={() => {
          setIsImportDialogOpen(false);
          toast('导入完成，正在同步...', 'success');
        }}
      />
    </div>
  );
}
