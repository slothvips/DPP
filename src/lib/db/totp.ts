export type {
  AddTotpAccountArgs,
  AddTotpAccountResult,
  DeleteTotpAccountArgs,
  ReorderTotpAccountsArgs,
  TotpMutationResult,
  UpdateTotpAccountArgs,
} from './totpShared';
export { getTotpAccount, listTotpAccounts } from './totpQueries';
export {
  addTotpAccount,
  deleteTotpAccount,
  reorderTotpAccounts,
  updateTotpAccount,
} from './totpMutations';
