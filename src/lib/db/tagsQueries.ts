import { db } from '@/db';
import type { JobTagItem, TagItem, TagWithCounts } from '@/db/types';

export interface TagAssociation {
  entityId: string;
  entityType: 'link' | 'job';
  name: string;
  detail?: string;
}

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

export async function getTagAssociations(tagId: string): Promise<TagAssociation[]> {
  const [linkTags, jobTags] = await Promise.all([
    db.linkTags
      .where('tagId')
      .equals(tagId)
      .filter((item) => !item.deletedAt)
      .toArray(),
    db.jobTags
      .where('tagId')
      .equals(tagId)
      .filter((item) => !item.deletedAt)
      .toArray(),
  ]);
  const [links, jobs] = await Promise.all([
    db.links.bulkGet(linkTags.map((linkTag) => linkTag.linkId)),
    db.jobs.bulkGet(jobTags.map((jobTag) => jobTag.jobUrl)),
  ]);

  return [
    ...linkTags.map((linkTag, index) => {
      const link = links[index];
      return {
        entityId: linkTag.linkId,
        entityType: 'link' as const,
        name: link?.name ?? linkTag.linkId,
        detail: link?.url,
      };
    }),
    ...jobTags.map((jobTag, index) => {
      const job = jobs[index];
      return {
        entityId: jobTag.jobUrl,
        entityType: 'job' as const,
        name: job?.fullName ?? job?.name ?? jobTag.jobUrl,
        detail: jobTag.jobUrl,
      };
    }),
  ];
}
