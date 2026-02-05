import type Dexie from 'dexie';
import type { Table } from 'dexie';
import type { JobTagItem, LinkTagItem } from './types';

/**
 * Type-safe wrapper for compound key table operations
 * Dexie's compound keys return [string, string] but we wrap them for type safety
 */

/**
 * LinkTags table with type-safe operations for compound key [linkId, tagId]
 */
export type LinkTagsTable = Table<LinkTagItem, [string, string]>;

/**
 * JobTags table with type-safe operations for compound key [jobUrl, tagId]
 */
export type JobTagsTable = Table<JobTagItem, [string, string]>;

/**
 * Get link tag by compound key
 */
export async function getLinkTag(
  table: LinkTagsTable,
  linkId: string,
  tagId: string
): Promise<LinkTagItem | undefined> {
  return await table.get([linkId, tagId]);
}

/**
 * Put link tag with compound key
 * Returns the compound key [linkId, tagId]
 */
export async function putLinkTag(table: LinkTagsTable, item: LinkTagItem): Promise<void> {
  await table.put(item);
}

/**
 * Add link tag with compound key
 * Returns the compound key [linkId, tagId]
 */
export async function addLinkTag(table: LinkTagsTable, item: LinkTagItem): Promise<void> {
  await table.add(item);
}

/**
 * Delete link tag by compound key
 */
export async function deleteLinkTag(
  table: LinkTagsTable,
  linkId: string,
  tagId: string
): Promise<void> {
  await table.delete([linkId, tagId]);
}

/**
 * Get job tag by compound key
 */
export async function getJobTag(
  table: JobTagsTable,
  jobUrl: string,
  tagId: string
): Promise<JobTagItem | undefined> {
  return await table.get([jobUrl, tagId]);
}

/**
 * Put job tag with compound key
 * Returns the compound key [jobUrl, tagId]
 */
export async function putJobTag(table: JobTagsTable, item: JobTagItem): Promise<void> {
  await table.put(item);
}

/**
 * Add job tag with compound key
 * Returns the compound key [jobUrl, tagId]
 */
export async function addJobTag(table: JobTagsTable, item: JobTagItem): Promise<void> {
  await table.add(item);
}

/**
 * Delete job tag by compound key
 */
export async function deleteJobTag(
  table: JobTagsTable,
  jobUrl: string,
  tagId: string
): Promise<void> {
  await table.delete([jobUrl, tagId]);
}

/**
 * Generic entity tag operations
 * Used for dynamic table selection based on entity type
 */
export interface EntityTagOperations<T> {
  get(pk: [string, string]): Promise<T | undefined>;
  put(item: T): Promise<void>;
  add(item: T): Promise<void>;
  delete(pk: [string, string]): Promise<void>;
}

/**
 * Get entity tag table with proper typing based on entity type
 */
export function getEntityTagTable(
  db: Dexie,
  type: 'link'
): { table: LinkTagsTable; operations: EntityTagOperations<LinkTagItem> };
export function getEntityTagTable(
  db: Dexie,
  type: 'job'
): { table: JobTagsTable; operations: EntityTagOperations<JobTagItem> };
export function getEntityTagTable(
  db: Dexie,
  type: 'link' | 'job'
):
  | { table: LinkTagsTable; operations: EntityTagOperations<LinkTagItem> }
  | { table: JobTagsTable; operations: EntityTagOperations<JobTagItem> } {
  if (type === 'link') {
    const table = db.table('linkTags') as unknown as LinkTagsTable;
    return {
      table,
      operations: {
        get: (pk) => table.get(pk),
        put: async (item: LinkTagItem) => {
          await table.put(item);
        },
        add: async (item: LinkTagItem) => {
          await table.add(item);
        },
        delete: (pk) => table.delete(pk),
      },
    };
  }

  const table = db.table('jobTags') as unknown as JobTagsTable;
  return {
    table,
    operations: {
      get: (pk) => table.get(pk),
      put: async (item: JobTagItem) => {
        await table.put(item);
      },
      add: async (item: JobTagItem) => {
        await table.add(item);
      },
      delete: (pk) => table.delete(pk),
    },
  };
}

/**
 * Create entity tag item based on type
 */
export function createEntityTagItem(
  type: 'link',
  entityId: string,
  tagId: string
): Omit<LinkTagItem, 'updatedAt'>;
export function createEntityTagItem(
  type: 'job',
  entityId: string,
  tagId: string
): Omit<JobTagItem, 'updatedAt'>;
export function createEntityTagItem(
  type: 'link' | 'job',
  entityId: string,
  tagId: string
): Omit<LinkTagItem, 'updatedAt'> | Omit<JobTagItem, 'updatedAt'> {
  if (type === 'link') {
    return { linkId: entityId, tagId };
  }

  return { jobUrl: entityId, tagId };
}
