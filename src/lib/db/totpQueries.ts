import type { TotpAccountItem } from '@/features/totp/types';
import { getTotpTable } from './totpShared';

function getSortKey(item: TotpAccountItem): number {
  return typeof item.sortOrder === 'number' ? item.sortOrder : item.createdAt;
}

export async function listTotpAccounts(): Promise<TotpAccountItem[]> {
  const items = await getTotpTable().toArray();
  items.sort((a, b) => getSortKey(a) - getSortKey(b) || a.createdAt - b.createdAt);
  return items;
}

export async function getTotpAccount(id: string): Promise<TotpAccountItem | undefined> {
  return getTotpTable().get(id);
}
