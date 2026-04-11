export type {
  AddBlackboardArgs,
  AddBlackboardResult,
  BlackboardListItem,
  BlackboardListResult,
  BlackboardMutationResult,
  DeleteBlackboardArgs,
  ToggleBlackboardArgs,
  UpdateBlackboardArgs,
} from './blackboardShared';
export { listBlackboard } from './blackboardQueries';
export {
  addBlackboard,
  deleteBlackboard,
  toggleBlackboardLock,
  toggleBlackboardPin,
  updateBlackboard,
} from './blackboardMutations';
