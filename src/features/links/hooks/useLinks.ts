import { useLiveQuery } from 'dexie-react-hooks';
import { type LinkItem, type TagItem, db } from '@/db';
import {
  addLink,
  bulkAddLinks as bulkAddLinksDB,
  deleteLink,
  recordLinkVisit,
  toggleLinkPin,
  updateLink,
} from '@/lib/db';

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
    await recordLinkVisit({ id });
  };

  const togglePin = async (id: string) => {
    await toggleLinkPin({ id });
  };

  const addLinkData = async (
    data: Omit<LinkItem, 'id' | 'updatedAt' | 'category' | 'createdAt'> & { tags?: string[] }
  ) => {
    // Use unified addLink function - pass tag IDs directly
    const result = await addLink({
      name: data.name,
      url: data.url,
      note: data.note,
      tags: data.tags,
    });
    return result.id;
  };

  const bulkAddLinks = async (
    items: Array<
      Omit<LinkItem, 'id' | 'updatedAt' | 'category' | 'createdAt'> & { tags?: string[] }
    >
  ) => {
    await bulkAddLinksDB({
      links: items.map((data) => ({
        name: data.name,
        url: data.url,
        note: data.note,
        tags: data.tags,
      })),
    });
  };

  const updateLinkData = async (
    id: string,
    data: Partial<Omit<LinkItem, 'id' | 'updatedAt' | 'category' | 'createdAt'>> & {
      tags?: string[];
    }
  ) => {
    // Use unified updateLink function - pass tag IDs directly
    await updateLink({
      id,
      name: data.name,
      url: data.url,
      note: data.note,
      tags: data.tags,
    });
  };

  const deleteLinkData = async (id: string) => {
    // Use unified deleteLink function
    await deleteLink({ id });
  };

  return {
    links,
    recordVisit,
    togglePin,
    addLink: addLinkData,
    bulkAddLinks,
    updateLink: updateLinkData,
    deleteLink: deleteLinkData,
  };
}
