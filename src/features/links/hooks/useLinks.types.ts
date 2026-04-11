import type { LinkItem, TagItem } from '@/db';

export interface LinkWithStats extends LinkItem {
  usageCount: number;
  lastUsedAt: number;
  pinnedAt?: number;
  tags: TagItem[];
}

export type LinkFormData = Omit<LinkItem, 'id' | 'updatedAt' | 'category' | 'createdAt'> & {
  tags?: string[];
};

export type PartialLinkFormData = Partial<
  Omit<LinkItem, 'id' | 'updatedAt' | 'category' | 'createdAt'>
> & {
  tags?: string[];
};
