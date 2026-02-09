import type { Table } from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import { type LinkItem, type TagItem, db } from '@/db';
import type { LinkTagItem } from '@/db/types';
import { recordLinkVisit } from '@/features/links/utils';

export interface LinkWithStats extends LinkItem {
  usageCount: number;
  lastUsedAt: number;
  pinnedAt?: number;
  tags: TagItem[];
}

export function useLinks() {
  const links = useLiveQuery(async () => {
    const [allLinks, allStats, allLinkTags, allTags] = await Promise.all([
      db.links.filter((l) => !l.deletedAt).toArray(),
      db.linkStats.toArray(),
      db.linkTags.filter((lt) => !lt.deletedAt).toArray(),
      db.tags.filter((t) => !t.deletedAt).toArray(),
    ]);

    const statsMap = new Map(allStats.map((s) => [s.id, s]));
    const tagsMap = new Map(allTags.map((t) => [t.id, t]));

    const linkTagsMap = new Map<string, TagItem[]>();
    for (const lt of allLinkTags) {
      const tag = tagsMap.get(lt.tagId);
      if (tag) {
        const current = linkTagsMap.get(lt.linkId) || [];
        current.push(tag);
        linkTagsMap.set(lt.linkId, current);
      }
    }

    return allLinks.map((link) => ({
      ...link,
      usageCount: statsMap.get(link.id)?.usageCount || 0,
      lastUsedAt: statsMap.get(link.id)?.lastUsedAt || 0,
      pinnedAt: statsMap.get(link.id)?.pinnedAt,
      tags: linkTagsMap.get(link.id) || [],
    }));
  }, []);

  const recordVisit = async (id: string) => {
    await recordLinkVisit(id);
  };

  const togglePin = async (id: string) => {
    await db.transaction('rw', db.linkStats, async () => {
      const stat = await db.linkStats.get(id);
      const isPinned = !!stat?.pinnedAt;
      await db.linkStats.put({
        id,
        usageCount: stat?.usageCount || 0,
        lastUsedAt: stat?.lastUsedAt || 0,
        pinnedAt: isPinned ? undefined : Date.now(),
      });
    });
  };

  const addLink = async (
    data: Omit<LinkItem, 'id' | 'updatedAt' | 'category' | 'createdAt'> & { tags?: string[] }
  ) => {
    const id = crypto.randomUUID();
    const now = Date.now();

    const linkTagsTable = db.linkTags as unknown as Table<LinkTagItem, [string, string]>;

    await db.transaction('rw', db.links, linkTagsTable, async () => {
      await db.links.add({
        id,
        name: data.name,
        url: data.url,
        note: data.note,
        category: '',
        updatedAt: now,
        createdAt: now,
      });

      if (data.tags && data.tags.length > 0) {
        for (const tagId of data.tags) {
          await linkTagsTable.add({
            linkId: id,
            tagId,
            updatedAt: now,
          });
        }
      }
    });

    return id;
  };

  const bulkAddLinks = async (
    items: Array<
      Omit<LinkItem, 'id' | 'updatedAt' | 'category' | 'createdAt'> & { tags?: string[] }
    >
  ) => {
    const now = Date.now();
    const linkTagsTable = db.linkTags as unknown as Table<LinkTagItem, [string, string]>;

    await db.transaction('rw', db.links, db.tags, linkTagsTable, async () => {
      // Pre-fetch all tags to minimize queries if needed, though simpler to just trust IDs are passed or handled
      // Actually the import dialog will handle tag creation/lookup before calling this if strictly following ID pattern,
      // OR we can make this smarter.
      // For simplicity and matching addLink, we assume tags are passed as IDs.
      // If we want to support creating tags on the fly during bulk import, we'd need more logic.
      // The current requirement says "convert ... to format system can import", usually implying normalized data.
      // Let's assume the import logic in the dialog will resolve tag names to IDs or create them.
      // Wait, the prompt says "convert arbitrary data". The LLM output might just have tag names.
      // It would be much better if bulkAddLinks handled tag name -> ID resolution automatically.

      // Let's stick to the current pattern: The caller resolves tags.
      // But wait, `addLink` takes `tags: string[]` which are IDs.
      // So `bulkAddLinks` should also take IDs.
      // The ImportDialog will handle the "Tag Name -> Tag ID" logic.

      for (const data of items) {
        const id = crypto.randomUUID();
        await db.links.add({
          id,
          name: data.name,
          url: data.url,
          note: data.note,
          category: '',
          updatedAt: now,
          createdAt: now,
        });

        if (data.tags && data.tags.length > 0) {
          for (const tagId of data.tags) {
            await linkTagsTable.add({
              linkId: id,
              tagId,
              updatedAt: now,
            });
          }
        }
      }
    });
  };

  const updateLink = async (
    id: string,
    data: Partial<Omit<LinkItem, 'id' | 'updatedAt' | 'category' | 'createdAt'>> & {
      tags?: string[];
    }
  ) => {
    const linkTagsTable = db.linkTags as unknown as Table<LinkTagItem, [string, string]>;

    await db.transaction('rw', db.links, linkTagsTable, async () => {
      const now = Date.now();

      const { tags, ...linkData } = data;
      if (Object.keys(linkData).length > 0) {
        await db.links.update(id, {
          ...linkData,
          updatedAt: now,
        });
      }

      if (tags) {
        const existingLinkTags = await db.linkTags.where('linkId').equals(id).toArray();
        const existingTagIds = new Set(
          existingLinkTags.filter((lt) => !lt.deletedAt).map((lt) => lt.tagId)
        );
        const newTagIds = new Set(tags);

        for (const tagId of tags) {
          if (!existingTagIds.has(tagId)) {
            const deletedTag = existingLinkTags.find((lt) => lt.tagId === tagId && lt.deletedAt);
            if (deletedTag) {
              await linkTagsTable.put({ ...deletedTag, deletedAt: undefined, updatedAt: now });
            } else {
              await linkTagsTable.add({ linkId: id, tagId, updatedAt: now });
            }
          }
        }

        for (const existingId of existingTagIds) {
          if (!newTagIds.has(existingId)) {
            await db.linkTags
              .where({ linkId: id, tagId: existingId })
              .modify({ deletedAt: now, updatedAt: now });
          }
        }
      }
    });
  };

  const deleteLink = async (id: string) => {
    const linkTagsTable = db.linkTags as unknown as Table<LinkTagItem, [string, string]>;

    await db.transaction('rw', db.links, db.linkStats, linkTagsTable, async () => {
      await db.links.update(id, { deletedAt: Date.now(), updatedAt: Date.now() });

      const linkTags = await db.linkTags.where('linkId').equals(id).toArray();
      for (const lt of linkTags) {
        await linkTagsTable.delete([lt.linkId, lt.tagId]);
      }

      await db.linkStats.delete(id);
    });
  };

  return {
    links,
    recordVisit,
    togglePin,
    addLink,
    bulkAddLinks,
    updateLink,
    deleteLink,
  };
}
