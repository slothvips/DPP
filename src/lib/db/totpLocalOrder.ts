import { db } from '@/db';

/** 本地排序记录 key，此表不参与同步 */
const ORDER_KEY = 'order';

export async function getTotpLocalOrder(): Promise<string[] | undefined> {
  const record = await db.totpLocalOrder.get(ORDER_KEY);
  return record?.orderedIds;
}

export async function saveTotpLocalOrder(orderedIds: string[]): Promise<void> {
  await db.totpLocalOrder.put({ key: ORDER_KEY, orderedIds });
}

export async function clearTotpLocalOrder(): Promise<void> {
  await db.totpLocalOrder.delete(ORDER_KEY);
}
