import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
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

interface UseCommonTagSelectorOptions {
  type: 'link' | 'job';
  id: string;
  pendingSelectedIds?: Set<string>;
  onPendingToggle?: (tagId: string) => void;
  availableTags?: TagItem[];
}

export function useCommonTagSelector({
  type,
  id,
  pendingSelectedIds,
  onPendingToggle,
  availableTags,
}: UseCommonTagSelectorOptions) {
  const { toast } = useToast();
  const { confirm } = useConfirmDialog();

  const tags =
    useLiveQuery(() => (availableTags ? availableTags : getAllActiveTags()), [availableTags]) || [];
  const activeEntityTagIds = useLiveQuery(() => getActiveEntityTagIds(id, type), [type, id]);

  const activeTagIds = useMemo(
    () => new Set<string>(pendingSelectedIds ? pendingSelectedIds : activeEntityTagIds || []),
    [activeEntityTagIds, pendingSelectedIds]
  );

  const handleToggleTag = async (tagId: string) => {
    if (onPendingToggle) {
      onPendingToggle(tagId);
      return;
    }

    try {
      await toggleTagAssociation({ tagId, entityId: id, entityType: type });
    } catch (error) {
      toast(error instanceof Error ? error.message : '操作失败', 'error');
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
      if (!confirmed) {
        return;
      }

      await deleteTag({ id: tagId });
      toast('标签已删除', 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : '删除标签失败', 'error');
    }
  };

  const handleCreateTag = async (tagName: string) => {
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
          if (result.isExisting) {
            toast(`已关联现有标签 "${tagName}"`, 'success');
          }
        } else {
          toast(`标签 "${tagName}" 已选择`, 'info');
        }
        return;
      }

      if (!activeTagIds.has(tagId)) {
        await toggleTagAssociation({ tagId, entityId: id, entityType: type });
        if (result.isExisting) {
          toast(`已关联现有标签 "${tagName}"`, 'success');
        }
      } else {
        toast(`标签 "${tagName}" 已存在`, 'info');
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : '添加或关联标签失败', 'error');
    }
  };

  return {
    tags,
    activeTagIds,
    handleToggleTag,
    handleDeleteTag,
    handleCreateTag,
  };
}
