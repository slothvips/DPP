import { db } from '@/db';
import type { TotpAccountItem, TotpAlgorithm, TotpDigits } from '@/features/totp/types';

export interface TotpMutationResult {
  success: boolean;
  message: string;
}

export interface AddTotpAccountResult extends TotpMutationResult {
  id: string;
}

export interface AddTotpAccountArgs {
  label: string;
  issuer?: string;
  account?: string;
  secret: string;
  algorithm?: TotpAlgorithm;
  digits?: TotpDigits;
  period?: number;
}

export interface UpdateTotpAccountArgs {
  id: string;
  label?: string;
  issuer?: string;
  account?: string;
}

export interface DeleteTotpAccountArgs {
  id: string;
}

export interface ReorderTotpAccountsArgs {
  orderedIds: string[];
}

export function getTotpTable() {
  return db.totpAccounts;
}

export async function getTotpAccountOrThrow(id: string): Promise<TotpAccountItem> {
  const item = await getTotpTable().get(id);
  if (!item) {
    throw new Error('验证器账户不存在或已被删除');
  }
  return item;
}
