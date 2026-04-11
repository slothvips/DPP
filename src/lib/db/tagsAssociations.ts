import { db } from '@/db';

export async function toggleTagAssociation(args: {
  tagId: string;
  entityId: string;
  entityType: 'link' | 'job';
}): Promise<{ success: boolean; message: string }> {
  const tag = await db.tags.get(args.tagId);
  if (!tag || tag.deletedAt) {
    throw new Error('标签不存在或已被删除');
  }

  const now = Date.now();

  if (args.entityType === 'link') {
    const link = await db.links.get(args.entityId);
    if (!link || link.deletedAt) {
      throw new Error('链接不存在或已被删除');
    }

    const existingAssociation = await db.linkTags
      .filter(
        (linkTag) =>
          !linkTag.deletedAt && linkTag.tagId === args.tagId && linkTag.linkId === args.entityId
      )
      .first();

    if (existingAssociation) {
      await db.linkTags
        .where({ linkId: args.entityId, tagId: args.tagId })
        .modify({ deletedAt: now });
      return {
        success: true,
        message: `Tag "${tag.name}" removed from link`,
      };
    }

    await db.linkTags.add({
      tagId: args.tagId,
      linkId: args.entityId,
      updatedAt: now,
    });
    return {
      success: true,
      message: `Tag "${tag.name}" added to link`,
    };
  }

  const job = await db.jobs.get(args.entityId);
  if (!job) {
    throw new Error('任务不存在或已被删除');
  }

  const existingAssociation = await db.jobTags
    .filter(
      (jobTag) =>
        !jobTag.deletedAt && jobTag.tagId === args.tagId && jobTag.jobUrl === args.entityId
    )
    .first();

  if (existingAssociation) {
    await db.jobTags.where({ jobUrl: args.entityId, tagId: args.tagId }).modify({ deletedAt: now });
    return {
      success: true,
      message: `Tag "${tag.name}" removed from job`,
    };
  }

  await db.jobTags.add({
    tagId: args.tagId,
    jobUrl: args.entityId,
    updatedAt: now,
  });
  return {
    success: true,
    message: `Tag "${tag.name}" added to job`,
  };
}
