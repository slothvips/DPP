import type { Table } from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import React from 'react';
import { TagSelector } from '@/components/ui/tag-selector';
import { useToast } from '@/components/ui/toast';
import { db } from '@/db';
import type { JobTagItem, LinkTagItem, TagItem } from '@/db/types';
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
    useLiveQuery(
      () => (availableTags ? availableTags : db.tags.filter((t) => !t.deletedAt).toArray()),
      [availableTags]
    ) || [];

  const activeEntityTags = useLiveQuery(async () => {
    if (!id) return [];

    if (type === 'link') {
      return db.linkTags
        .where('linkId')
        .equals(id)
        .filter((item) => !item.deletedAt)
        .toArray();
    }

    return db.jobTags
      .where('jobUrl')
      .equals(id)
      .filter((item) => !item.deletedAt)
      .toArray();
  }, [type, id]);

  const activeTagIds = new Set<string>(
    pendingSelectedIds ? pendingSelectedIds : activeEntityTags?.map((t) => t.tagId) || []
  );

  const handleToggleTag = async (tagId: string) => {
    if (onPendingToggle) {
      onPendingToggle(tagId);
      return;
    }

    const now = Date.now();

    if (type === 'link') {
      const table = db.linkTags as unknown as Table<LinkTagItem, [string, string]>;
      const pk: [string, string] = [id, tagId];
      const existing = await table.get(pk);

      if (existing && !existing.deletedAt) {
        await table.put({ ...existing, deletedAt: now, updatedAt: now });
      } else if (existing) {
        await table.put({ ...existing, deletedAt: undefined, updatedAt: now });
      } else {
        await table.add({ linkId: id, tagId, updatedAt: now });
      }
    } else {
      const table = db.jobTags as unknown as Table<JobTagItem, [string, string]>;
      const pk: [string, string] = [id, tagId];
      const existing = await table.get(pk);

      if (existing && !existing.deletedAt) {
        await table.put({ ...existing, deletedAt: now, updatedAt: now });
      } else if (existing) {
        await table.put({ ...existing, deletedAt: undefined, updatedAt: now });
      } else {
        await table.add({ jobUrl: id, tagId, updatedAt: now });
      }
    }
  };

  const handleDeleteTag = async (tagId: string, tagName: string) => {
    const jobCount = await db.jobTags
      .where('tagId')
      .equals(tagId)
      .filter((jt) => !jt.deletedAt)
      .count();

    const linkCount = await db.linkTags
      .where('tagId')
      .equals(tagId)
      .filter((lt) => !lt.deletedAt)
      .count();

    const totalCount = jobCount + linkCount;

    if (totalCount > 0) {
      toast(`无法删除标签 "${tagName}"：有 ${totalCount} 个项目正在使用它。`, 'error');
      return;
    }

    const confirmed = await confirm(`确定要删除标签 "${tagName}" 吗？`, '确认删除', 'danger');
    if (confirmed) {
      await db.tags.delete(tagId);
      toast('标签已删除', 'success');
    }
  };

  const handleCreateTag = async (tagName: string) => {
    // 验证标签名称长度
    const validation = validateLength(tagName, VALIDATION_LIMITS.TAG_NAME_MAX, '标签名称');
    if (!validation.valid) {
      toast(validation.error ?? '标签名称长度超出限制', 'error');
      return;
    }

    const existingTag = await db.tags.where('name').equals(tagName).first();
    let tagId: string;
    const now = Date.now();

    if (existingTag) {
      tagId = existingTag.id;
      if (existingTag.deletedAt) {
        await db.tags.put({ ...existingTag, deletedAt: undefined, updatedAt: now });
      }
    } else {
      const newId = crypto.randomUUID();
      await db.tags.add({
        id: newId,
        name: tagName,
        color: 'blue',
        updatedAt: now,
      });
      tagId = newId;
    }

    if (onPendingToggle) {
      if (!activeTagIds.has(tagId)) {
        onPendingToggle(tagId);
        if (existingTag) toast(`已关联现有标签 "${tagName}"`, 'success');
      } else {
        toast(`标签 "${tagName}" 已选择`, 'info');
      }
      return;
    }

    if (type === 'link') {
      const table = db.linkTags as unknown as Table<LinkTagItem, [string, string]>;
      const pk: [string, string] = [id, tagId];
      const existingRelation = await table.get(pk);

      if (existingRelation && !existingRelation.deletedAt) {
        toast(`标签 "${tagName}" 已存在`, 'info');
        return;
      }

      if (existingRelation) {
        await table.put({ ...existingRelation, deletedAt: undefined, updatedAt: now });
        toast(`已关联现有标签 "${tagName}"`, 'success');
      } else {
        await table.add({ linkId: id, tagId, updatedAt: now });
        if (existingTag) toast(`已关联现有标签 "${tagName}"`, 'success');
      }
    } else {
      const table = db.jobTags as unknown as Table<JobTagItem, [string, string]>;
      const pk: [string, string] = [id, tagId];
      const existingRelation = await table.get(pk);

      if (existingRelation && !existingRelation.deletedAt) {
        toast(`标签 "${tagName}" 已存在`, 'info');
        return;
      }

      if (existingRelation) {
        await table.put({ ...existingRelation, deletedAt: undefined, updatedAt: now });
        toast(`已关联现有标签 "${tagName}"`, 'success');
      } else {
        await table.add({ jobUrl: id, tagId, updatedAt: now });
        if (existingTag) toast(`已关联现有标签 "${tagName}"`, 'success');
      }
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
