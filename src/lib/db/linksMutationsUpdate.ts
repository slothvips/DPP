import { db } from '@/db';
import type { LinkTagChanges, UpdateLinkArgs } from './linksMutationsShared';
import { getLinkTagsTable, isValidLinkUrl, resolveTagNamesToIds } from './linksShared';

async function resolveLinkTagChanges(
  args: UpdateLinkArgs,
  now: number
): Promise<LinkTagChanges | undefined> {
  const newTagIds = args.tags ? await resolveTagNamesToIds(args.tags) : undefined;
  if (newTagIds === undefined) {
    return undefined;
  }

  const existingLinkTags = await getLinkTagsTable().where('linkId').equals(args.id).toArray();
  const existingTagIds = new Set(
    existingLinkTags.filter((linkTag) => !linkTag.deletedAt).map((linkTag) => linkTag.tagId)
  );

  const toAdd: LinkTagChanges['toAdd'] = [];
  const toUpdate: LinkTagChanges['toUpdate'] = [];
  const toDelete: LinkTagChanges['toDelete'] = [];
  const tagIdSet = new Set(newTagIds);

  for (const tagId of newTagIds) {
    if (existingTagIds.has(tagId)) {
      continue;
    }

    const deletedTag = existingLinkTags.find(
      (linkTag) => linkTag.tagId === tagId && linkTag.deletedAt
    );
    if (deletedTag) {
      toUpdate.push({ ...deletedTag, deletedAt: undefined, updatedAt: now });
    } else {
      toAdd.push({ linkId: args.id, tagId, updatedAt: now });
    }
  }

  for (const existingId of existingTagIds) {
    if (!tagIdSet.has(existingId)) {
      toDelete.push([args.id, existingId]);
    }
  }

  return { toAdd, toUpdate, toDelete };
}

export async function updateLink(
  args: UpdateLinkArgs
): Promise<{ success: boolean; message: string }> {
  const existingLink = await db.links.get(args.id);
  if (!existingLink) {
    throw new Error('链接不存在或已被删除');
  }

  if (args.url && !isValidLinkUrl(args.url)) {
    throw new Error('URL 格式不正确，请以 http:// 或 https:// 开头');
  }

  const now = Date.now();
  const tagChanges = await resolveLinkTagChanges(args, now);

  await db.transaction('rw', db.links, getLinkTagsTable(), async () => {
    await db.links.update(args.id, {
      name: args.name ?? existingLink.name,
      url: args.url ?? existingLink.url,
      note: args.note ?? existingLink.note,
      updatedAt: now,
    });

    if (!tagChanges) {
      return;
    }

    if (tagChanges.toAdd.length > 0) {
      await getLinkTagsTable().bulkAdd(tagChanges.toAdd);
    }
    if (tagChanges.toUpdate.length > 0) {
      await getLinkTagsTable().bulkPut(tagChanges.toUpdate);
    }
    for (const [linkId, tagId] of tagChanges.toDelete) {
      await getLinkTagsTable().where({ linkId, tagId }).modify({ deletedAt: now, updatedAt: now });
    }
  });

  return {
    success: true,
    message: 'Link updated successfully',
  };
}
