import { useLiveQuery } from 'dexie-react-hooks';
import { LoaderCircle, Unlink } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { getTagAssociations, removeTagAssociation } from '@/lib/db/tags';
import type { TagAssociation } from '@/lib/db/tags';

interface TagDeleteDialogProps {
  tag: { id: string; name: string } | null;
  onOpenChange: (open: boolean) => void;
  onDelete: () => Promise<void>;
}

export function TagDeleteDialog({ tag, onOpenChange, onDelete }: TagDeleteDialogProps) {
  const { toast } = useToast();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const associations = useLiveQuery(
    () => (tag ? getTagAssociations(tag.id) : Promise.resolve([])),
    [tag?.id]
  );
  const isLoading = tag !== null && associations === undefined;
  const items = associations ?? [];

  async function handleRemove(association: TagAssociation) {
    if (!tag) {
      return;
    }

    const associationId = `${association.entityType}:${association.entityId}`;
    setRemovingId(associationId);
    try {
      await removeTagAssociation({
        tagId: tag.id,
        entityId: association.entityId,
        entityType: association.entityType,
      });
    } catch (error) {
      toast(error instanceof Error ? error.message : '取消关联失败', 'error');
    } finally {
      setRemovingId(null);
    }
  }

  async function handleDelete() {
    try {
      await onDelete();
      onOpenChange(false);
    } catch (error) {
      toast(error instanceof Error ? error.message : '删除标签失败', 'error');
    }
  }

  function renderAssociation(association: TagAssociation) {
    const associationId = `${association.entityType}:${association.entityId}`;
    const isRemoving = removingId === associationId;

    return (
      <div
        key={associationId}
        className="flex min-w-0 items-center gap-2 border-b py-2 last:border-b-0"
      >
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm">{association.name}</div>
          {association.detail && (
            <div className="truncate text-xs text-muted-foreground">{association.detail}</div>
          )}
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">
          {association.entityType === 'link' ? '链接' : 'Jenkins 任务'}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0 px-2 text-muted-foreground hover:text-destructive"
          onClick={() => void handleRemove(association)}
          disabled={removingId !== null}
          title="取消关联"
          aria-label={`取消关联 ${association.name}`}
        >
          {isRemoving ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Unlink className="h-4 w-4" />
          )}
          <span className="sr-only">取消关联</span>
        </Button>
      </div>
    );
  }

  return (
    <Dialog open={tag !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>删除标签</DialogTitle>
          <DialogDescription>
            {tag ? `标签“${tag.name}”正在被以下项目使用，请先取消关联。` : ''}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-6">
            <LoaderCircle className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length > 0 ? (
          <div className="max-h-64 overflow-y-auto rounded border px-3">
            {items.map(renderAssociation)}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">当前没有关联项目，可以删除此标签。</p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void handleDelete()}
            disabled={isLoading || items.length > 0 || tag === null}
          >
            删除标签
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
