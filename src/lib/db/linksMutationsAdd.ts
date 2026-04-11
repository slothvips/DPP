import { db } from '@/db';
import type { AddLinkArgs, BulkAddLinksArgs } from './linksMutationsShared';
import { getLinkTagsTable, isValidLinkUrl, resolveTagNamesToIds } from './linksShared';

export async function addLink(
  args: AddLinkArgs
): Promise<{ success: boolean; id: string; message: string }> {
  if (!isValidLinkUrl(args.url)) {
    throw new Error('URL 格式不正确，请以 http:// 或 https:// 开头');
  }

  const now = Date.now();
  const id = crypto.randomUUID();
  const tagIds = args.tags ? await resolveTagNamesToIds(args.tags) : [];

  await db.transaction('rw', db.links, getLinkTagsTable(), async () => {
    await db.links.add({
      id,
      name: args.name,
      url: args.url,
      note: args.note,
      category: '',
      createdAt: now,
      updatedAt: now,
    });

    for (const tagId of tagIds) {
      await getLinkTagsTable().add({
        linkId: id,
        tagId,
        updatedAt: now,
      });
    }
  });

  return {
    success: true,
    id,
    message: `Link "${args.name}" added successfully`,
  };
}

export async function bulkAddLinks(
  args: BulkAddLinksArgs
): Promise<{ success: boolean; count: number; message: string }> {
  const now = Date.now();
  const results: Array<{ name: string; url: string; note?: string; tags: string[] }> = [];

  for (const link of args.links) {
    if (!isValidLinkUrl(link.url)) {
      throw new Error(`URL "${link.url}" 格式不正确，请以 http:// 或 https:// 开头`);
    }

    const tagIds = link.tags ? await resolveTagNamesToIds(link.tags) : [];
    results.push({
      name: link.name,
      url: link.url,
      note: link.note,
      tags: tagIds,
    });
  }

  await db.transaction('rw', db.links, getLinkTagsTable(), async () => {
    for (const link of results) {
      const id = crypto.randomUUID();
      await db.links.add({
        id,
        name: link.name,
        url: link.url,
        note: link.note,
        category: '',
        createdAt: now,
        updatedAt: now,
      });

      for (const tagId of link.tags) {
        await getLinkTagsTable().add({
          linkId: id,
          tagId,
          updatedAt: now,
        });
      }
    }
  });

  return {
    success: true,
    count: results.length,
    message: `Successfully added ${results.length} links`,
  };
}
