import { db } from '@/db';
import { getLinkTagsTable } from './linksShared';
import { buildRandomTagColor, findTagByName, getJobTagsTable } from './tagsShared';

export async function addTag(args: {
  name: string;
  color?: string;
}): Promise<{ success: boolean; id: string; message: string }> {
  const now = Date.now();
  const id = crypto.randomUUID();
  const color = args.color ?? buildRandomTagColor();

  let result: { success: boolean; id: string; message: string };

  await db.transaction('rw', db.tags, async () => {
    const existing = await db.tags
      .filter((tag) => !tag.deletedAt && tag.name.toLowerCase() === args.name.toLowerCase())
      .first();
    if (existing) {
      throw new Error(`标签 "${args.name}" 已存在`);
    }

    await db.tags.add({
      id,
      name: args.name,
      color,
      updatedAt: now,
    });

    result = {
      success: true,
      id,
      message: `Tag "${args.name}" created successfully`,
    };
  });

  return result!;
}

export async function ensureTagsExist(names: string[]): Promise<Map<string, string>> {
  if (names.length === 0) {
    return new Map();
  }

  const tagMap = new Map<string, string>();
  const now = Date.now();

  await db.transaction('rw', db.tags, async () => {
    for (const name of names) {
      if (!name || name.trim() === '') {
        continue;
      }

      const trimmedName = name.trim();
      const existing = await findTagByName(trimmedName);
      if (existing) {
        if (existing.deletedAt) {
          await db.tags.update(existing.id, { deletedAt: undefined, updatedAt: now });
        }
        tagMap.set(trimmedName, existing.id);
        continue;
      }

      const newId = crypto.randomUUID();
      await db.tags.add({
        id: newId,
        name: trimmedName,
        color: 'blue',
        updatedAt: now,
      });
      tagMap.set(trimmedName, newId);
    }
  });

  return tagMap;
}

export async function createOrReactivateTag(args: {
  name: string;
}): Promise<{ success: boolean; id: string; message: string; isExisting: boolean }> {
  const trimmedName = args.name.trim();
  const now = Date.now();

  let result: { success: boolean; id: string; message: string; isExisting: boolean };

  await db.transaction('rw', db.tags, async () => {
    const existing = await findTagByName(trimmedName);
    if (existing) {
      if (existing.deletedAt) {
        await db.tags.update(existing.id, { deletedAt: undefined, updatedAt: now });
      }

      result = {
        success: true,
        id: existing.id,
        message: existing.deletedAt
          ? `Tag "${trimmedName}" reactivated`
          : `Tag "${trimmedName}" already exists`,
        isExisting: true,
      };
      return;
    }

    const newId = crypto.randomUUID();
    await db.tags.add({
      id: newId,
      name: trimmedName,
      color: 'blue',
      updatedAt: now,
    });

    result = {
      success: true,
      id: newId,
      message: `Tag "${trimmedName}" created successfully`,
      isExisting: false,
    };
  });

  return result!;
}

export async function updateTag(args: {
  id: string;
  name?: string;
  color?: string;
}): Promise<{ success: boolean; message: string }> {
  const existing = await db.tags.get(args.id);
  if (!existing) {
    throw new Error('标签不存在或已被删除');
  }

  if (args.name && args.name.toLowerCase() !== existing.name.toLowerCase()) {
    const duplicate = await db.tags
      .filter((tag) => !tag.deletedAt && tag.name.toLowerCase() === args.name!.toLowerCase())
      .first();
    if (duplicate) {
      throw new Error(`标签 "${args.name}" 已存在`);
    }
  }

  await db.tags.update(args.id, {
    name: args.name ?? existing.name,
    color: args.color ?? existing.color,
    updatedAt: Date.now(),
  });

  return {
    success: true,
    message: 'Tag updated successfully',
  };
}

export async function deleteTag(args: {
  id: string;
}): Promise<{ success: boolean; message: string }> {
  const existing = await db.tags.get(args.id);
  if (!existing) {
    throw new Error('标签不存在或已被删除');
  }

  const now = Date.now();

  await db.transaction('rw', db.tags, getLinkTagsTable(), getJobTagsTable(), async () => {
    await db.tags.update(args.id, { deletedAt: now });
    await db.linkTags.where({ tagId: args.id }).modify({ deletedAt: now });
    await db.jobTags.where({ tagId: args.id }).modify({ deletedAt: now });
  });

  return {
    success: true,
    message: `Tag "${existing.name}" deleted successfully`,
  };
}
