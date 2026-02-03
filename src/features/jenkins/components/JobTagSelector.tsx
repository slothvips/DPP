import React from 'react';
import { CommonTagSelector } from '@/features/tags/components/CommonTagSelector';

interface Props {
  jobUrl: string;
}

export function JobTagSelector({ jobUrl }: Props) {
  return <CommonTagSelector type="job" id={jobUrl} />;
}
