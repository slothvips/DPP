// Unified blackboard (便签) database operations
import { db } from '@/db';

/**
 * List all blackboard items
 */
export async function listBlackboard(): Promise<{
  total: number;
  items: Array<{
    id: string;
    content: string;
    pinned: boolean;
    locked: boolean;
    createdAt: number;
    updatedAt: number;
  }>;
}> {
  const items = await db.blackboard.filter((item) => !item.deletedAt).toArray();

  // Sort: pinned first, then by createdAt descending
  items.sort((a, b) => {
    if (a.pinned !== b.pinned) return b.pinned ? 1 : -1;
    return b.createdAt - a.createdAt;
  });

  return {
    total: items.length,
    items: items.map((item) => ({
      id: item.id,
      content: item.content,
      pinned: item.pinned || false,
      locked: item.locked || false,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })),
  };
}

/**
 * Add a new blackboard item
 */
export async function addBlackboard(args: {
  content: string;
  pinned?: boolean;
}): Promise<{ success: boolean; id: string; message: string }> {
  const now = Date.now();
  const id = crypto.randomUUID();

  await db.blackboard.add({
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

/**
 * Update a blackboard item
 */
export async function updateBlackboard(args: {
  id: string;
  content?: string;
  pinned?: boolean;
  locked?: boolean;
}): Promise<{ success: boolean; message: string }> {
  const existing = await db.blackboard.get(args.id);
  if (!existing) {
    throw new Error(`便签不存在或已被删除`);
  }

  await db.blackboard.update(args.id, {
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

/**
 * Delete a blackboard item (soft delete)
 */
export async function deleteBlackboard(args: {
  id: string;
}): Promise<{ success: boolean; message: string }> {
  const existing = await db.blackboard.get(args.id);
  if (!existing) {
    throw new Error(`便签不存在或已被删除`);
  }

  // Soft delete: set deletedAt timestamp
  const now = Date.now();
  await db.blackboard.update(args.id, {
    deletedAt: now,
    updatedAt: now,
  });

  return {
    success: true,
    message: 'Blackboard item deleted successfully',
  };
}

/**
 * Toggle blackboard item pinned status
 */
export async function toggleBlackboardPin(args: {
  id: string;
}): Promise<{ success: boolean; message: string }> {
  const existing = await db.blackboard.get(args.id);
  if (!existing) {
    throw new Error(`便签不存在或已被删除`);
  }

  const newPinnedStatus = !existing.pinned;
  await db.blackboard.update(args.id, {
    pinned: newPinnedStatus,
    updatedAt: Date.now(),
  });

  return {
    success: true,
    message: newPinnedStatus ? '便签已置顶' : '便签已取消置顶',
  };
}

/**
 * Toggle blackboard item locked status
 */
export async function toggleBlackboardLock(args: {
  id: string;
}): Promise<{ success: boolean; message: string }> {
  const existing = await db.blackboard.get(args.id);
  if (!existing) {
    throw new Error(`便签不存在或已被删除`);
  }

  const newLockedStatus = !existing.locked;
  await db.blackboard.update(args.id, {
    locked: newLockedStatus,
    updatedAt: Date.now(),
  });

  return {
    success: true,
    message: newLockedStatus ? '便签已锁定' : '便签已解锁',
  };
}
