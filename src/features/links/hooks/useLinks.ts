import { useLiveQuery } from 'dexie-react-hooks';
import {
  addLink,
  bulkAddLinks as bulkAddLinksDB,
  deleteLink,
  getAllActiveLinkTags,
  getAllActiveLinks,
  getAllActiveTags,
  getAllLinkStats,
  recordLinkVisit,
  toggleLinkPin,
  updateLink,
} from '@/lib/db';
import type { LinkFormData, PartialLinkFormData } from './useLinks.types';
import { buildLinksWithStats } from './useLinksData';

export type { LinkWithStats } from './useLinks.types';

export function useLinks() {
  const links = useLiveQuery(async () => {
    const [allLinks, allStats, allLinkTags, allTags] = await Promise.all([
      getAllActiveLinks(),
      getAllLinkStats(),
      getAllActiveLinkTags(),
      getAllActiveTags(),
    ]);

    return buildLinksWithStats(allLinks, allStats, allLinkTags, allTags);
  }, []);

  const recordVisit = async (id: string) => {
    await recordLinkVisit({ id });
  };

  const togglePin = async (id: string) => {
    await toggleLinkPin({ id });
  };

  const addLinkData = async (data: LinkFormData) => {
    // Use unified addLink function - pass tag IDs directly
    const result = await addLink({
      name: data.name,
      url: data.url,
      note: data.note,
      tags: data.tags,
    });
    return result.id;
  };

  const bulkAddLinks = async (items: LinkFormData[]) => {
    await bulkAddLinksDB({
      links: items.map((data) => ({
        name: data.name,
        url: data.url,
        note: data.note,
        tags: data.tags,
      })),
    });
  };

  const updateLinkData = async (id: string, data: PartialLinkFormData) => {
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
