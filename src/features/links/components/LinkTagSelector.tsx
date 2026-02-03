import React from 'react';
import { CommonTagSelector } from '@/features/tags/components/CommonTagSelector';

interface Props {
  linkId: string;
  selectedTagIds?: Set<string>;
  onTogglePending?: (tagId: string) => void;
}

export function LinkTagSelector({ linkId, selectedTagIds, onTogglePending }: Props) {
  return (
    <CommonTagSelector
      type="link"
      id={linkId}
      pendingSelectedIds={selectedTagIds}
      onPendingToggle={onTogglePending}
    />
  );
}
