import { useLiveQuery } from 'dexie-react-hooks';
import {
  addTotpAccount,
  deleteTotpAccount,
  listTotpAccounts,
  reorderTotpAccounts,
  updateTotpAccount,
} from '@/lib/db/totp';
import type {
  AddTotpAccountArgs,
  ReorderTotpAccountsArgs,
  UpdateTotpAccountArgs,
} from '@/lib/db/totp';

export function useTotpAccounts() {
  const accounts = useLiveQuery(() => listTotpAccounts(), []) ?? [];

  async function addAccount(data: AddTotpAccountArgs) {
    return addTotpAccount(data);
  }

  async function updateAccount(data: UpdateTotpAccountArgs) {
    return updateTotpAccount(data);
  }

  async function removeAccount(id: string) {
    return deleteTotpAccount({ id });
  }

  async function reorderAccounts(data: ReorderTotpAccountsArgs) {
    return reorderTotpAccounts(data);
  }

  return {
    accounts,
    addAccount,
    updateAccount,
    removeAccount,
    reorderAccounts,
  };
}
