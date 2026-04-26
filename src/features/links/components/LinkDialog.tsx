import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { LinkItem, TagItem } from '@/db';
import { VALIDATION_LIMITS } from '@/utils/validation';
import { LinkTagSelector } from './LinkTagSelector';
import { useLinkDialogForm } from './useLinkDialogForm';

interface LinkDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialData: (LinkItem & { tags?: TagItem[] }) | null;
  onSave: (
    data: Omit<LinkItem, 'id' | 'updatedAt' | 'category' | 'createdAt'> & { tags?: string[] }
  ) => Promise<void>;
}

export function LinkDialog({ isOpen, onClose, initialData, onSave }: LinkDialogProps) {
  const {
    formData,
    loading,
    selectedTagIds,
    urlError,
    handleNameChange,
    handleNoteChange,
    handleSubmit,
    handleTogglePendingTag,
    handleUrlChange,
  } = useLinkDialogForm({
    isOpen,
    onClose,
    initialData,
    onSave,
  });

  const hasError = !!urlError;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] border-border/60 bg-background/96">
        <DialogHeader>
          <DialogTitle>{initialData ? '编辑链接' : '添加链接'}</DialogTitle>
          <DialogDescription>{initialData ? '修改链接信息。' : '添加常用链接。'}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-3">
          <div className="grid gap-2">
            <Label htmlFor="name">名称</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(event) => handleNameChange(event.target.value)}
              placeholder="e.g. GitHub"
              maxLength={VALIDATION_LIMITS.LINK_NAME_MAX}
              required
            />
            <p className="text-xs text-muted-foreground">
              {formData.name.length} / {VALIDATION_LIMITS.LINK_NAME_MAX}
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="url">URL</Label>
            <Input
              id="url"
              value={formData.url}
              onChange={(event) => handleUrlChange(event.target.value)}
              placeholder="https://..."
              maxLength={VALIDATION_LIMITS.LINK_URL_MAX}
              className={urlError ? 'border-destructive' : ''}
              required
            />
            {urlError ? (
              <p className="text-xs text-destructive">{urlError}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {formData.url.length} / {VALIDATION_LIMITS.LINK_URL_MAX}
              </p>
            )}
          </div>
          <div className="grid gap-2">
            <Label>标签</Label>
            <LinkTagSelector
              linkId={initialData?.id || ''}
              selectedTagIds={selectedTagIds}
              onTogglePending={handleTogglePendingTag}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="note">备注</Label>
            <Textarea
              id="note"
              value={formData.note}
              onChange={(event) => handleNoteChange(event.target.value)}
              placeholder="备注信息..."
              maxLength={VALIDATION_LIMITS.LINK_NOTE_MAX}
            />
            <p className="text-xs text-muted-foreground">
              {formData.note.length} / {VALIDATION_LIMITS.LINK_NOTE_MAX}
            </p>
          </div>
          <DialogFooter className="gap-2 pt-1 sm:gap-0">
            <Button type="button" variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" disabled={loading || hasError}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
