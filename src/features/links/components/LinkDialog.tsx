import { Loader2 } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
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
import { useToast } from '@/components/ui/toast';
import type { LinkItem, TagItem } from '@/db';
import { VALIDATION_LIMITS, validateLength } from '@/utils/validation';
import { LinkTagSelector } from './LinkTagSelector';

interface LinkDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialData: (LinkItem & { tags?: TagItem[] }) | null;
  onSave: (
    data: Omit<LinkItem, 'id' | 'updatedAt' | 'category'> & { tags?: string[] }
  ) => Promise<void>;
}

export function LinkDialog({ isOpen, onClose, initialData, onSave }: LinkDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    note: '',
  });
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({
          name: initialData.name,
          url: initialData.url,
          note: initialData.note || '',
        });
        setSelectedTagIds(new Set(initialData.tags?.map((t) => t.id) || []));
      } else {
        setFormData({
          name: '',
          url: '',
          note: '',
        });
        setSelectedTagIds(new Set());
      }
    }
  }, [isOpen, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.url) return;

    // 验证字段长度
    const nameValidation = validateLength(formData.name, VALIDATION_LIMITS.LINK_NAME_MAX, '名称');
    if (!nameValidation.valid) {
      toast(nameValidation.error ?? '名称长度超出限制', 'error');
      return;
    }

    const urlValidation = validateLength(formData.url, VALIDATION_LIMITS.LINK_URL_MAX, 'URL');
    if (!urlValidation.valid) {
      toast(urlValidation.error ?? 'URL长度超出限制', 'error');
      return;
    }

    const noteValidation = validateLength(formData.note, VALIDATION_LIMITS.LINK_NOTE_MAX, '备注');
    if (!noteValidation.valid) {
      toast(noteValidation.error ?? '备注长度超出限制', 'error');
      return;
    }

    setLoading(true);
    try {
      await onSave({
        name: formData.name.trim(),
        url: formData.url.trim(),
        note: formData.note.trim(),
        tags: Array.from(selectedTagIds),
      });
      setLoading(false);
      onClose();
    } catch {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{initialData ? '编辑链接' : '添加链接'}</DialogTitle>
          <DialogDescription>
            {initialData ? '修改现有的链接信息。' : '添加一个新的常用链接。'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">名称</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              placeholder="https://..."
              maxLength={VALIDATION_LIMITS.LINK_URL_MAX}
              required
            />
            <p className="text-xs text-muted-foreground">
              {formData.url.length} / {VALIDATION_LIMITS.LINK_URL_MAX}
            </p>
          </div>
          <div className="grid gap-2">
            <Label>标签</Label>
            <LinkTagSelector
              linkId={initialData?.id || ''}
              selectedTagIds={selectedTagIds}
              onTogglePending={(tagId) => {
                const next = new Set(selectedTagIds);
                if (next.has(tagId)) {
                  next.delete(tagId);
                } else {
                  next.add(tagId);
                }
                setSelectedTagIds(next);
              }}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="note">备注</Label>
            <Textarea
              id="note"
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              placeholder="备注信息..."
              maxLength={VALIDATION_LIMITS.LINK_NOTE_MAX}
            />
            <p className="text-xs text-muted-foreground">
              {formData.note.length} / {VALIDATION_LIMITS.LINK_NOTE_MAX}
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
