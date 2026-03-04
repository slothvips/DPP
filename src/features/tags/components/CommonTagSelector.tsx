import { useLiveQuery } from 'dexie-react-hooks';
import React from 'react';
import { TagSelector } from '@/components/ui/tag-selector';
import { useToast } from '@/components/ui/toast';
import type { TagItem } from '@/db/types';
import {
  createOrReactivateTag,
  deleteTag,
  getActiveEntityTagIds,
  getAllActiveTags,
  getTagUsageCount,
  toggleTagAssociation,
} from '@/lib/db/tags';
import { useConfirmDialog } from '@/utils/confirm-dialog';
import { VALIDATION_LIMITS, validateLength } from '@/utils/validation';

interface CommonTagSelectorProps {
  type: 'link' | 'job';
  id: string;
  pendingSelectedIds?: Set<string>;
  onPendingToggle?: (tagId: string) => void;
  availableTags?: TagItem[];
}

export function CommonTagSelector({
  type,
  id,
  pendingSelectedIds,
  onPendingToggle,
  availableTags,
}: CommonTagSelectorProps) {
  const { toast } = useToast();
  const { confirm } = useConfirmDialog();

  const tags =
    useLiveQuery(() => (availableTags ? availableTags : getAllActiveTags()), [availableTags]) || [];

  const activeEntityTagIds = useLiveQuery(() => getActiveEntityTagIds(id, type), [type, id]);

  const activeTagIds = new Set<string>(
    pendingSelectedIds ? pendingSelectedIds : activeEntityTagIds || []
  );

  const handleToggleTag = async (tagId: string) => {
    if (onPendingToggle) {
      onPendingToggle(tagId);
      return;
    }

    try {
      await toggleTagAssociation({ tagId, entityId: id, entityType: type });
    } catch (e) {
      toast(e instanceof Error ? e.message : '操作失败', 'error');
    }
  };

  const handleDeleteTag = async (tagId: string, tagName: string) => {
    try {
      const totalCount = await getTagUsageCount(tagId);

      if (totalCount > 0) {
        toast(`无法删除标签 "${tagName}"：有 ${totalCount} 个项目正在使用它。`, 'error');
        return;
      }

      const confirmed = await confirm(`确定要删除标签 "${tagName}" 吗？`, '确认删除', 'danger');
      if (confirmed) {
        await deleteTag({ id: tagId });
        toast('标签已删除', 'success');
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : '删除标签失败', 'error');
    }
  };

  const handleCreateTag = async (tagName: string) => {
    // 验证标签名称长度
    const validation = validateLength(tagName, VALIDATION_LIMITS.TAG_NAME_MAX, '标签名称');
    if (!validation.valid) {
      toast(validation.error ?? '标签名称长度超出限制', 'error');
      return;
    }

    try {
      const result = await createOrReactivateTag({ name: tagName });
      const tagId = result.id;

      if (onPendingToggle) {
        if (!activeTagIds.has(tagId)) {
          onPendingToggle(tagId);
          if (result.isExisting) toast(`已关联现有标签 "${tagName}"`, 'success');
        } else {
          toast(`标签 "${tagName}" 已选择`, 'info');
        }
        return;
      }

      if (!activeTagIds.has(tagId)) {
        await toggleTagAssociation({ tagId, entityId: id, entityType: type });
        if (result.isExisting) toast(`已关联现有标签 "${tagName}"`, 'success');
      } else {
        toast(`标签 "${tagName}" 已存在`, 'info');
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : '添加或关联标签失败', 'error');
    }
  };

  return (
    <TagSelector
      availableTags={tags}
      selectedTagIds={activeTagIds}
      onToggleTag={handleToggleTag}
      onCreateTag={handleCreateTag}
      onDeleteTag={handleDeleteTag}
    />
  );
}
