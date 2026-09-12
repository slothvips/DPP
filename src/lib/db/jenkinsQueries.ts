import type { JenkinsJobRecord, JobItem } from '@/db';
import { db } from '@/db';
import { normalizePage } from './pagination';
import { getSetting } from './settings';

export async function listJobs(args: {
  keyword?: string;
  page?: number;
  pageSize?: number;
}): Promise<{
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  jobs: Array<{
    name: string;
    url: string;
    color: string;
    type: string;
    fullName?: string;
    lastStatus?: string;
    lastBuildTime?: number;
    lastBuildUrl?: string;
    env: string;
  }>;
}> {
  const { page, pageSize, offset } = normalizePage(args, 20, 100);
  const keyword = args.keyword?.toLowerCase();
  const envId = await getSetting('jenkins_current_env');
  if (!envId) {
    return { total: 0, page, pageSize, hasMore: false, jobs: [] };
  }
  const matches = db.jenkinsJobs
    .where('envId')
    .equals(envId)
    .filter(
      (job) =>
        !keyword ||
        job.name.toLowerCase().includes(keyword) ||
        Boolean(job.fullName?.toLowerCase().includes(keyword)) ||
        Boolean(job.url?.toLowerCase().includes(keyword))
    );
  const total = await matches.count();
  const jobs = await matches.offset(offset).limit(pageSize).toArray();

  return {
    total,
    page,
    pageSize,
    hasMore: offset + pageSize < total,
    jobs: jobs.map((job) => ({
      name: job.name,
      url: job.url,
      color: job.color || '',
      type: job.type || '',
      fullName: job.fullName,
      lastStatus: job.lastStatus,
      lastBuildTime: job.lastBuildTime,
      lastBuildUrl: job.lastBuildUrl,
      env: job.env || '',
    })),
  };
}

export async function getAllScopedJenkinsJobs(): Promise<JenkinsJobRecord[]> {
  return db.jenkinsJobs.toArray();
}

export async function getJob(args: {
  jobUrl: string;
  envId?: string;
}): Promise<JobItem | undefined> {
  const envId = args.envId ?? (await getSetting('jenkins_current_env'));
  if (!envId) return undefined;
  return db.jenkinsJobs
    .where('envId')
    .equals(envId)
    .filter((job) => job.url === args.jobUrl)
    .first();
}
