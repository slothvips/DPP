import {
  type BlackboardListResult,
  getBlackboardTable,
  mapBlackboardListItem,
} from './blackboardShared';
import { type PageArgs, normalizePage } from './pagination';

export async function listBlackboard(
  args: PageArgs = {}
): Promise<BlackboardListResult & { page: number; pageSize: number; hasMore: boolean }> {
  const { page, pageSize, offset } = normalizePage(args, 20, 100);
  const table = getBlackboardTable();
  const [pinnedTotal, unpinnedTotal] = await Promise.all([
    table.filter((item) => item.pinned === true && !item.deletedAt).count(),
    table.filter((item) => item.pinned !== true && !item.deletedAt).count(),
  ]);
  const total = pinnedTotal + unpinnedTotal;
  const pinnedItems =
    offset < pinnedTotal
      ? await table
          .orderBy('createdAt')
          .reverse()
          .filter((item) => item.pinned === true && !item.deletedAt)
          .offset(offset)
          .limit(pageSize)
          .toArray()
      : [];
  const remaining = pageSize - pinnedItems.length;
  const unpinnedOffset = Math.max(0, offset - pinnedTotal);
  const unpinnedItems =
    remaining > 0
      ? await table
          .orderBy('createdAt')
          .reverse()
          .filter((item) => item.pinned !== true && !item.deletedAt)
          .offset(unpinnedOffset)
          .limit(remaining)
          .toArray()
      : [];
  const pageItems = [...pinnedItems, ...unpinnedItems];
  return {
    total,
    page,
    pageSize,
    hasMore: offset + pageSize < total,
    items: pageItems.map(mapBlackboardListItem),
  };
}
