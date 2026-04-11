import React from 'react';
import { TagSelector } from '@/components/ui/tag-selector';
import type { TagItem } from '@/db/types';
import { useCommonTagSelector } from './useCommonTagSelector';

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
  const { tags, activeTagIds, handleToggleTag, handleDeleteTag, handleCreateTag } =
    useCommonTagSelector({
      type,
      id,
      pendingSelectedIds,
      onPendingToggle,
      availableTags,
    });

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
