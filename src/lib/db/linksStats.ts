import { db } from '@/db';

export async function toggleLinkPin(args: {
  id: string;
}): Promise<{ success: boolean; message: string }> {
  const existingLink = await db.links.get(args.id);
  if (!existingLink) {
    throw new Error('链接不存在或已被删除');
  }

  const now = Date.now();
  const stat = await db.linkStats.get(args.id);
  const currentPinnedAt = stat?.pinnedAt;

  await db.transaction('rw', db.linkStats, async () => {
    if (currentPinnedAt) {
      await db.linkStats.update(args.id, { pinnedAt: undefined });
      return;
    }

    if (stat) {
      await db.linkStats.update(args.id, { pinnedAt: now });
      return;
    }

    await db.linkStats.add({
      id: args.id,
      usageCount: 0,
      lastUsedAt: now,
      pinnedAt: now,
    });
  });

  return {
    success: true,
    message: currentPinnedAt ? 'Link unpinned successfully' : 'Link pinned successfully',
  };
}

export async function recordLinkVisit(args: {
  id: string;
}): Promise<{ success: boolean; message: string }> {
  const existingLink = await db.links.get(args.id);
  if (!existingLink) {
    throw new Error('链接不存在或已被删除');
  }

  const now = Date.now();

  await db.transaction('rw', db.linkStats, async () => {
    const stat = await db.linkStats.get(args.id);
    if (stat) {
      await db.linkStats.update(args.id, {
        usageCount: (stat.usageCount || 0) + 1,
        lastUsedAt: now,
      });
      return;
    }

    await db.linkStats.add({
      id: args.id,
      usageCount: 1,
      lastUsedAt: now,
    });
  });

  return {
    success: true,
    message: 'Link visit recorded',
  };
}
