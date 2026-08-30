import type { JobItem } from '@/db';
import { db } from '@/db';
import { normalizePage } from './pagination';

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
  const matches = db.jobs
    .toCollection()
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

export async function getAllJobs(): Promise<JobItem[]> {
  return db.jobs.toArray();
}

export async function getJob(args: { jobUrl: string }): Promise<JobItem | undefined> {
  return db.jobs.get(args.jobUrl);
}

export async function listBuilds(args: {
  jobUrl: string;
  limit?: number;
  offset?: number;
}): Promise<{
  job: { name: string; url: string; lastStatus?: string };
  builds: Array<{
    id: string;
    number: number;
    result?: string;
    timestamp: number;
    duration: number;
    building: boolean;
    userName?: string;
  }>;
  total: number;
}> {
  const job = await db.jobs.get(args.jobUrl);
  if (!job) {
    throw new Error(`Job not found: ${args.jobUrl}`);
  }

  const limit = Math.min(Math.max(1, args.limit ?? 20), 100);
  const offset = Math.max(0, args.offset ?? 0);
  const matches = db.myBuilds.toCollection().filter((build) => build.jobUrl === args.jobUrl);
  const total = await matches.count();
  const builds = await db.myBuilds
    .orderBy('timestamp')
    .reverse()
    .filter((build) => build.jobUrl === args.jobUrl)
    .offset(offset)
    .limit(limit)
    .toArray();

  return {
    job: {
      name: job.name,
      url: job.url,
      lastStatus: job.lastStatus,
    },
    builds: builds.map((build) => ({
      id: build.id,
      number: build.number,
      result: build.result,
      timestamp: build.timestamp,
      duration: build.duration || 0,
      building: build.building,
      userName: build.userName,
    })),
    total,
  };
}
