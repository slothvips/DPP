import { db } from '@/db';
import type { DeleteLinkArgs } from './linksMutationsShared';
import { getLinkTagsTable } from './linksShared';

export async function deleteLink(
  args: DeleteLinkArgs
): Promise<{ success: boolean; message: string }> {
  const existingLink = await db.links.get(args.id);
  if (!existingLink) {
    throw new Error('链接不存在或已被删除');
  }

  await db.transaction('rw', db.links, db.linkStats, getLinkTagsTable(), async () => {
    const now = Date.now();

    await db.links.update(args.id, { deletedAt: now, updatedAt: now });

    const linkTags = await getLinkTagsTable().where('linkId').equals(args.id).toArray();
    for (const linkTag of linkTags) {
      await getLinkTagsTable().update([linkTag.linkId, linkTag.tagId], {
        deletedAt: now,
        updatedAt: now,
      });
    }

    await db.linkStats.delete(args.id);
  });

  return {
    success: true,
    message: `Link "${existingLink.name}" deleted successfully`,
  };
}
