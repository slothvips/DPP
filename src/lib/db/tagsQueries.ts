import { db } from '@/db';
import type { JobTagItem, TagItem, TagWithCounts } from '@/db/types';

export async function getAllActiveTags(): Promise<TagItem[]> {
  return db.tags.filter((tag) => !tag.deletedAt).toArray();
}

export async function getAllJobTags(): Promise<JobTagItem[]> {
  return db.jobTags.toArray();
}

export async function getActiveEntityTagIds(
  entityId: string,
  entityType: 'link' | 'job'
): Promise<string[]> {
  if (!entityId) {
    return [];
  }

  if (entityType === 'link') {
    const linkTags = await db.linkTags
      .where('linkId')
      .equals(entityId)
      .filter((item) => !item.deletedAt)
      .toArray();
    return linkTags.map((linkTag) => linkTag.tagId);
  }

  const jobTags = await db.jobTags
    .where('jobUrl')
    .equals(entityId)
    .filter((item) => !item.deletedAt)
    .toArray();
  return jobTags.map((jobTag) => jobTag.tagId);
}

export async function listTags(): Promise<{
  total: number;
  tags: TagWithCounts[];
}> {
  const tags = await db.tags.filter((tag) => !tag.deletedAt).toArray();
  const [allLinkTags, allJobTags] = await Promise.all([
    db.linkTags.filter((linkTag) => !linkTag.deletedAt).toArray(),
    db.jobTags.filter((jobTag) => !jobTag.deletedAt).toArray(),
  ]);

  const linkCountByTagId = new Map<string, number>();
  const jobCountByTagId = new Map<string, number>();

  for (const linkTag of allLinkTags) {
    linkCountByTagId.set(linkTag.tagId, (linkCountByTagId.get(linkTag.tagId) ?? 0) + 1);
  }

  for (const jobTag of allJobTags) {
    jobCountByTagId.set(jobTag.tagId, (jobCountByTagId.get(jobTag.tagId) ?? 0) + 1);
  }

  return {
    total: tags.length,
    tags: tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      color: tag.color,
      linkCount: linkCountByTagId.get(tag.id) ?? 0,
      jobCount: jobCountByTagId.get(tag.id) ?? 0,
      createdAt: tag.updatedAt,
      updatedAt: tag.updatedAt,
    })),
  };
}

export async function getTagUsageCount(tagId: string): Promise<number> {
  const jobCount = await db.jobTags
    .where('tagId')
    .equals(tagId)
    .filter((jobTag) => !jobTag.deletedAt)
    .count();
  const linkCount = await db.linkTags
    .where('tagId')
    .equals(tagId)
    .filter((linkTag) => !linkTag.deletedAt)
    .count();

  return jobCount + linkCount;
}
