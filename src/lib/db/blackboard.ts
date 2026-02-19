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
}): Promise<{ success: boolean; message: string }> {
  const existing = await db.blackboard.get(args.id);
  if (!existing) {
    throw new Error(`便签不存在或已被删除`);
  }

  await db.blackboard.update(args.id, {
    content: args.content ?? existing.content,
    pinned: args.pinned ?? existing.pinned,
    updatedAt: Date.now(),
  });

  return {
    success: true,
    message: 'Blackboard item updated successfully',
  };
}

/**
 * Delete a blackboard item (physical delete - matching user tool behavior)
 */
export async function deleteBlackboard(args: {
  id: string;
}): Promise<{ success: boolean; message: string }> {
  const existing = await db.blackboard.get(args.id);
  if (!existing) {
    throw new Error(`便签不存在或已被删除`);
  }

  // Physical delete (matching user tool behavior)
  await db.blackboard.delete(args.id);

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
