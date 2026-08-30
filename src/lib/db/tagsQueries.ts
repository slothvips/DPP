import { db } from '@/db';
import type { JobTagItem, TagItem, TagWithCounts } from '@/db/types';
import { type PageArgs, normalizePage } from './pagination';

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

export async function listTags(args: PageArgs = {}): Promise<{
  total: number;
  tags: TagWithCounts[];
  page: number;
  pageSize: number;
  hasMore: boolean;
}> {
  const { page, pageSize, offset } = normalizePage(args, 20, 100);
  const total = await db.tags.filter((tag) => !tag.deletedAt).count();
  const tags = await db.tags
    .orderBy('updatedAt')
    .reverse()
    .filter((tag) => !tag.deletedAt)
    .offset(offset)
    .limit(pageSize)
    .toArray();
  const counts = await Promise.all(
    tags.map(async (tag) => {
      const [linkCount, jobCount] = await Promise.all([
        db.linkTags
          .where('tagId')
          .equals(tag.id)
          .filter((item) => !item.deletedAt)
          .count(),
        db.jobTags
          .where('tagId')
          .equals(tag.id)
          .filter((item) => !item.deletedAt)
          .count(),
      ]);
      return [tag.id, linkCount, jobCount] as const;
    })
  );
  const countMap = new Map(
    counts.map(([id, linkCount, jobCount]) => [id, { linkCount, jobCount }])
  );

  return {
    total,
    page,
    pageSize,
    hasMore: offset + pageSize < total,
    tags: tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      color: tag.color,
      linkCount: countMap.get(tag.id)?.linkCount ?? 0,
      jobCount: countMap.get(tag.id)?.jobCount ?? 0,
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
