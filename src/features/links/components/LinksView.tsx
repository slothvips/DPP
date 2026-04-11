import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { VirtualList } from '@/components/ui/virtual-list';
import { type LinkItem, type TagItem, db } from '@/db';
import { LinkDialog } from '@/features/links/components/LinkDialog';
import { LinkListItem } from '@/features/links/components/LinkListItem';
import { LinksToolbar } from '@/features/links/components/LinksToolbar';
import { type LinkWithStats, useLinks } from '@/features/links/hooks/useLinks';
import {
  type SortOption,
  useSortedFilteredLinks,
} from '@/features/links/hooks/useSortedFilteredLinks';
import { getSetting, updateSetting } from '@/lib/db/settings';
import { useConfirmDialog } from '@/utils/confirm-dialog';
import { logger } from '@/utils/logger';

export function LinksView() {
  const { links, recordVisit, togglePin, addLink, updateLink, deleteLink } = useLinks();
  const allTags = useLiveQuery(() => db.tags.filter((t) => !t.deletedAt).toArray()) || [];
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('createdAt');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<(LinkItem & { tags?: TagItem[] }) | null>(null);
  const { toast } = useToast();
  const { confirm } = useConfirmDialog();
  const isInitializedRef = useRef(false);

  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    const loadSort = async () => {
      const saved = await getSetting('links_sort_by');
      if (saved) {
        setSortBy(saved);
      }
    };
    loadSort();
  }, []);

  const handleSortChange = async (newSort: SortOption) => {
    setSortBy(newSort);
    await updateSetting('links_sort_by', newSort);
  };

  const filteredAndSortedLinks = useSortedFilteredLinks(links, search, sortBy);

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
      } catch (error) {
        logger.error('Failed to delete link:', error);
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
      <LinksToolbar
        onAdd={handleAdd}
        onSearchChange={setSearch}
        onSortChange={handleSortChange}
        search={search}
        sortBy={sortBy}
      />

      <VirtualList
        items={filteredAndSortedLinks ?? []}
        estimateSize={116}
        overscan={5}
        containerClassName="pr-1 pb-2 [&::-webkit-scrollbar]:hidden [scrollbar-width:none] flex-1 min-h-0"
        renderItem={(link) => (
          <LinkListItem
            key={link.id}
            availableTags={allTags}
            link={link}
            onDelete={handleDelete}
            onEdit={handleEdit}
            onRecordVisit={handleLinkClick}
            onTogglePin={togglePin}
          />
        )}
      />
      {filteredAndSortedLinks?.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          {search ? '未找到匹配的链接' : '暂无链接'}
        </div>
      )}

      <LinkDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        initialData={editingLink}
        onSave={handleSave}
      />
    </div>
  );
}
