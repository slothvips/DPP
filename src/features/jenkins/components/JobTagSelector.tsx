import React from 'react';
import type { TagItem } from '@/db/types';
import { CommonTagSelector } from '@/features/tags/components/CommonTagSelector';

interface Props {
  jobUrl: string;
  availableTags?: TagItem[];
}

export function JobTagSelector({ jobUrl, availableTags }: Props) {
  return <CommonTagSelector type="job" id={jobUrl} availableTags={availableTags} />;
}
