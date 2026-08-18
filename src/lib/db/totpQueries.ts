import type { TotpAccountItem } from '@/features/totp/types';
import { isSoftDeleted } from '@/lib/db/softDelete';
import { getTotpLocalOrder } from './totpLocalOrder';
import { getTotpTable } from './totpShared';

function getSortKey(item: TotpAccountItem): number {
  return typeof item.sortOrder === 'number' ? item.sortOrder : item.createdAt;
}

export async function listTotpAccounts(): Promise<TotpAccountItem[]> {
  const items = (await getTotpTable().toArray()).filter((item) => !isSoftDeleted(item));
  items.sort((a, b) => getSortKey(a) - getSortKey(b) || a.createdAt - b.createdAt);

  // 有本地排序时按本地顺序重排；本地缺失的账户（新导入/他设备新增）按 DB 顺序追加末尾
  const localOrder = await getTotpLocalOrder();
  if (!localOrder || localOrder.length === 0) {
    return items;
  }

  const byId = new Map(items.map((item) => [item.id, item]));
  const ordered: TotpAccountItem[] = [];
  for (const id of localOrder) {
    const item = byId.get(id);
    if (item) {
      ordered.push(item);
    }
  }

  const localIdSet = new Set(localOrder);
  const remaining = items.filter((item) => !localIdSet.has(item.id));

  return [...ordered, ...remaining];
}

export async function getTotpAccount(id: string): Promise<TotpAccountItem | undefined> {
  const item = await getTotpTable().get(id);
  if (!item || isSoftDeleted(item)) {
    return undefined;
  }
  return item;
}
