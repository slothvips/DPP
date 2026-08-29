import { db } from '@/db';

export async function toggleTagAssociation(args: {
  tagId: string;
  entityId: string;
  entityType: 'link' | 'job';
}): Promise<{ success: boolean; message: string }> {
  if (args.entityType === 'link') {
    return db.transaction('rw', ['tags', 'links', 'linkTags'], async () => {
      const [tag, link, existingAssociation] = await Promise.all([
        db.tags.get(args.tagId),
        db.links.get(args.entityId),
        db.linkTags.get([args.entityId, args.tagId]),
      ]);
      if (!tag || tag.deletedAt) throw new Error('标签不存在或已被删除');
      if (!link || link.deletedAt) throw new Error('链接不存在或已被删除');

      const now = Date.now();
      if (existingAssociation && !existingAssociation.deletedAt) {
        await db.linkTags.put({ ...existingAssociation, deletedAt: now, updatedAt: now });
        return { success: true, message: `Tag "${tag.name}" removed from link` };
      }

      await db.linkTags.put({
        tagId: args.tagId,
        linkId: args.entityId,
        updatedAt: now,
        deletedAt: undefined,
      });
      return { success: true, message: `Tag "${tag.name}" added to link` };
    });
  }

  return db.transaction('rw', ['tags', 'jobs', 'jobTags'], async () => {
    const [tag, job, existingAssociation] = await Promise.all([
      db.tags.get(args.tagId),
      db.jobs.get(args.entityId),
      db.jobTags.get([args.entityId, args.tagId]),
    ]);
    if (!tag || tag.deletedAt) throw new Error('标签不存在或已被删除');
    if (!job) throw new Error('任务不存在或已被删除');

    const now = Date.now();
    if (existingAssociation && !existingAssociation.deletedAt) {
      await db.jobTags.put({ ...existingAssociation, deletedAt: now, updatedAt: now });
      return { success: true, message: `Tag "${tag.name}" removed from job` };
    }

    await db.jobTags.put({
      tagId: args.tagId,
      jobUrl: args.entityId,
      updatedAt: now,
      deletedAt: undefined,
    });
    return { success: true, message: `Tag "${tag.name}" added to job` };
  });
}

export async function removeTagAssociation(args: {
  tagId: string;
  entityId: string;
  entityType: 'link' | 'job';
}): Promise<void> {
  const now = Date.now();

  if (args.entityType === 'link') {
    await db.linkTags
      .where({ linkId: args.entityId, tagId: args.tagId })
      .modify({ deletedAt: now, updatedAt: now });
    return;
  }

  await db.jobTags
    .where({ jobUrl: args.entityId, tagId: args.tagId })
    .modify({ deletedAt: now, updatedAt: now });
}
