import type React from 'react';
import { useEffect, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import type { LinkItem, TagItem } from '@/db';
import { isValidLinkUrl } from '@/lib/db/linksShared';
import { logger } from '@/utils/logger';
import { VALIDATION_LIMITS, validateLength } from '@/utils/validation';

interface LinkDialogFormData {
  name: string;
  url: string;
  note: string;
}

interface UseLinkDialogFormOptions {
  isOpen: boolean;
  onClose: () => void;
  initialData: (LinkItem & { tags?: TagItem[] }) | null;
  onSave: (
    data: Omit<LinkItem, 'id' | 'updatedAt' | 'category' | 'createdAt'> & { tags?: string[] }
  ) => Promise<void>;
}

const EMPTY_FORM: LinkDialogFormData = {
  name: '',
  url: '',
  note: '',
};

export function useLinkDialogForm({
  isOpen,
  onClose,
  initialData,
  onSave,
}: UseLinkDialogFormOptions) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<LinkDialogFormData>(EMPTY_FORM);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [urlError, setUrlError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (initialData) {
      setFormData({
        name: initialData.name,
        url: initialData.url,
        note: initialData.note || '',
      });
      setSelectedTagIds(new Set(initialData.tags?.map((tag) => tag.id) || []));
    } else {
      setFormData(EMPTY_FORM);
      setSelectedTagIds(new Set());
    }

    setUrlError('');
  }, [initialData, isOpen]);

  const updateFormField = <K extends keyof LinkDialogFormData>(
    key: K,
    value: LinkDialogFormData[K]
  ) => {
    setFormData((current) => ({ ...current, [key]: value }));
  };

  const handleNameChange = (value: string) => {
    updateFormField('name', value);
  };

  const handleNoteChange = (value: string) => {
    updateFormField('note', value);
  };

  const handleUrlChange = (value: string) => {
    updateFormField('url', value);
    if (value && !isValidLinkUrl(value.trim())) {
      setUrlError('请输入有效的 URL（以 http:// 或 https:// 开头）');
      return;
    }

    setUrlError('');
  };

  const handleTogglePendingTag = (tagId: string) => {
    setSelectedTagIds((current) => {
      const next = new Set(current);
      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
      return next;
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formData.name || !formData.url) return;

    if (!isValidLinkUrl(formData.url.trim())) {
      setUrlError('请输入有效的 URL（以 http:// 或 https:// 开头）');
      return;
    }

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
      onClose();
    } catch (error) {
      logger.error('Failed to save link:', error);
    } finally {
      setLoading(false);
    }
  };

  return {
    formData,
    loading,
    selectedTagIds,
    urlError,
    handleNameChange,
    handleNoteChange,
    handleSubmit,
    handleTogglePendingTag,
    handleUrlChange,
  };
}
