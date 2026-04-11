import { useMemo } from 'react';
import type { TagItem } from '@/db';
import type { LinkWithStats } from '@/features/links/hooks/useLinks';

export type SortOption = 'createdAt' | 'updatedAt' | 'usageCount' | 'lastUsedAt';

function matchesKeywords(link: LinkWithStats, search: string) {
  if (!search) {
    return true;
  }

  const keywords = search
    .toLowerCase()
    .split(' ')
    .filter((keyword) => keyword.trim().length > 0);

  if (keywords.length === 0) {
    return true;
  }

  const name = link.name.toLowerCase();
  const url = link.url.toLowerCase();
  const tagNames = link.tags?.map((tag: TagItem) => tag.name.toLowerCase()) || [];

  return keywords.every(
    (keyword) =>
      name.includes(keyword) ||
      url.includes(keyword) ||
      tagNames.some((tagName: string) => tagName.includes(keyword))
  );
}

function compareLinks(sortBy: SortOption, a: LinkWithStats, b: LinkWithStats) {
  const aPinned = !!a.pinnedAt;
  const bPinned = !!b.pinnedAt;
  if (aPinned !== bPinned) {
    return aPinned ? -1 : 1;
  }

  if (a.pinnedAt && b.pinnedAt) {
    return (b.pinnedAt || 0) - (a.pinnedAt || 0);
  }

  switch (sortBy) {
    case 'usageCount':
      if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount;
      break;
    case 'lastUsedAt': {
      const leftLastUsedAt = a.lastUsedAt || 0;
      const rightLastUsedAt = b.lastUsedAt || 0;
      if (rightLastUsedAt !== leftLastUsedAt) return rightLastUsedAt - leftLastUsedAt;
      break;
    }
    case 'updatedAt':
      if (b.updatedAt !== a.updatedAt) return b.updatedAt - a.updatedAt;
      break;
    case 'createdAt': {
      const leftCreatedAt = a.createdAt || a.updatedAt || 0;
      const rightCreatedAt = b.createdAt || b.updatedAt || 0;
      if (rightCreatedAt !== leftCreatedAt) return rightCreatedAt - leftCreatedAt;
      break;
    }
    default:
      break;
  }

  return a.name.localeCompare(b.name);
}

export function useSortedFilteredLinks(
  links: LinkWithStats[] | undefined,
  search: string,
  sortBy: SortOption
) {
  return useMemo(() => {
    if (!links) {
      return [];
    }

    return [...links]
      .filter((link) => matchesKeywords(link, search))
      .sort((left, right) => compareLinks(sortBy, left, right));
  }, [links, search, sortBy]);
}
