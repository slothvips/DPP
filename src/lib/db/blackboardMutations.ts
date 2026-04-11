import {
  type AddBlackboardArgs,
  type AddBlackboardResult,
  type BlackboardMutationResult,
  type DeleteBlackboardArgs,
  type ToggleBlackboardArgs,
  type UpdateBlackboardArgs,
  getBlackboardItemOrThrow,
  getBlackboardTable,
} from './blackboardShared';

export async function addBlackboard(args: AddBlackboardArgs): Promise<AddBlackboardResult> {
  const now = Date.now();
  const id = crypto.randomUUID();

  await getBlackboardTable().add({
    id,
    content: args.content,
    createdAt: now,
    updatedAt: now,
    pinned: args.pinned || false,
    locked: false,
  });

  return {
    success: true,
    id,
    message: 'Blackboard item added successfully',
  };
}

export async function updateBlackboard(
  args: UpdateBlackboardArgs
): Promise<BlackboardMutationResult> {
  const existing = await getBlackboardItemOrThrow(args.id);

  await getBlackboardTable().update(args.id, {
    content: args.content ?? existing.content,
    pinned: args.pinned ?? existing.pinned,
    locked: args.locked ?? existing.locked,
    updatedAt: Date.now(),
  });

  return {
    success: true,
    message: 'Blackboard item updated successfully',
  };
}

export async function deleteBlackboard(
  args: DeleteBlackboardArgs
): Promise<BlackboardMutationResult> {
  await getBlackboardItemOrThrow(args.id);

  const now = Date.now();
  await getBlackboardTable().update(args.id, {
    deletedAt: now,
    updatedAt: now,
  });

  return {
    success: true,
    message: 'Blackboard item deleted successfully',
  };
}

export async function toggleBlackboardPin(
  args: ToggleBlackboardArgs
): Promise<BlackboardMutationResult> {
  const existing = await getBlackboardItemOrThrow(args.id);
  const newPinnedStatus = !existing.pinned;

  await getBlackboardTable().update(args.id, {
    pinned: newPinnedStatus,
    updatedAt: Date.now(),
  });

  return {
    success: true,
    message: newPinnedStatus ? '便签已置顶' : '便签已取消置顶',
  };
}

export async function toggleBlackboardLock(
  args: ToggleBlackboardArgs
): Promise<BlackboardMutationResult> {
  const existing = await getBlackboardItemOrThrow(args.id);
  const newLockedStatus = !existing.locked;

  await getBlackboardTable().update(args.id, {
    locked: newLockedStatus,
    updatedAt: Date.now(),
  });

  return {
    success: true,
    message: newLockedStatus ? '便签已锁定' : '便签已解锁',
  };
}
