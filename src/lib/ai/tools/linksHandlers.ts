import { openLink } from '@/features/links/utils';
import {
  addLink,
  bulkAddLinks,
  deleteLink,
  getLink,
  listLinks,
  recordLinkVisit,
  toggleLinkPin,
  updateLink,
} from '@/lib/db';

export async function links_list(args: {
  keyword?: string;
  tags?: string[];
  page?: number;
  pageSize?: number;
}) {
  return listLinks(args);
}

export async function links_add(args: {
  name: string;
  url: string;
  note?: string;
  tags?: string[];
}) {
  return addLink(args);
}

export async function links_update(args: {
  id: string;
  name?: string;
  url?: string;
  note?: string;
  tags?: string[];
}) {
  return updateLink(args);
}

export async function links_delete(args: { id: string }) {
  return deleteLink(args);
}

export async function links_visit(args: { id: string }) {
  const link = await getLink(args);
  if (!link) {
    throw new Error(`Link with id ${args.id} not found`);
  }

  await openLink(link.url);

  return {
    success: true,
    message: `Opening "${link.name}" in new tab`,
    url: link.url,
  };
}

export async function links_togglePin(args: { id: string }) {
  return toggleLinkPin(args);
}

export async function links_recordVisit(args: { id: string }) {
  return recordLinkVisit(args);
}

export async function links_bulkAdd(args: {
  links: Array<{ name: string; url: string; note?: string; tags?: string[] }>;
}) {
  return bulkAddLinks(args);
}
