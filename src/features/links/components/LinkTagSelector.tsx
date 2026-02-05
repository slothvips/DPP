import React from 'react';
import type { TagItem } from '@/db/types';
import { CommonTagSelector } from '@/features/tags/components/CommonTagSelector';

interface Props {
  linkId: string;
  selectedTagIds?: Set<string>;
  onTogglePending?: (tagId: string) => void;
  availableTags?: TagItem[];
}

export function LinkTagSelector({ linkId, selectedTagIds, onTogglePending, availableTags }: Props) {
  return (
    <CommonTagSelector
      type="link"
      id={linkId}
      pendingSelectedIds={selectedTagIds}
      onPendingToggle={onTogglePending}
      availableTags={availableTags}
    />
  );
}
