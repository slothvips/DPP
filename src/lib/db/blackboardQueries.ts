import {
  type BlackboardListResult,
  getBlackboardTable,
  mapBlackboardListItem,
} from './blackboardShared';

export async function listBlackboard(): Promise<BlackboardListResult> {
  const items = await getBlackboardTable()
    .filter((item) => !item.deletedAt)
    .toArray();

  items.sort((a, b) => {
    if (a.pinned !== b.pinned) {
      return b.pinned ? 1 : -1;
    }

    return b.createdAt - a.createdAt;
  });

  return {
    total: items.length,
    items: items.map(mapBlackboardListItem),
  };
}
