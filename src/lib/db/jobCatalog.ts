import { db } from '@/db';
import type { JobItem } from '@/db';

/**
 * URL-keyed job lookup for consumers that are not environment-aware (tags, global
 * search). Reads the environment-scoped catalog.
 */
export async function getJobByUrl(jobUrl: string): Promise<JobItem | undefined> {
  return db.jenkinsJobs.where('url').equals(jobUrl).first();
}

export async function getJobsByUrls(jobUrls: string[]): Promise<Array<JobItem | undefined>> {
  const scoped = await db.jenkinsJobs.where('url').anyOf(jobUrls).toArray();
  const byUrl = new Map(scoped.map((job) => [job.url, job]));
  return jobUrls.map((url) => byUrl.get(url));
}
