import Dexie from 'dexie';
import { registerDatabaseSchema } from './schema';
import { createSyncEngineFacade, getSyncEngine as loadSyncEngine } from './syncEngine';
import type {
  DPPDatabase,
  HotNewsCache,
  JobItem,
  JobTagItem,
  LinkItem,
  MyBuildItem,
  TagItem,
} from './types';

export * from './types';
export type { Recording } from '@/features/recorder/types';

export const db = new Dexie('DPPDB') as DPPDatabase;

registerDatabaseSchema(db);

export async function getSyncEngine() {
  return loadSyncEngine(db);
}

export const syncEngine = createSyncEngineFacade(db);

export type { LinkItem, JobItem, TagItem, JobTagItem, MyBuildItem, HotNewsCache };
