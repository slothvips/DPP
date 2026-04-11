import type { JobItem } from '@/db';
import { db } from '@/db';

export async function listJobs(args: { keyword?: string }): Promise<{
  total: number;
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
  let jobs = await db.jobs.toArray();

  if (args.keyword) {
    const keyword = args.keyword.toLowerCase();
    jobs = jobs.filter(
      (job) =>
        job.name.toLowerCase().includes(keyword) ||
        (job.fullName && job.fullName.toLowerCase().includes(keyword)) ||
        (job.url && job.url.toLowerCase().includes(keyword))
    );
  }

  return {
    total: jobs.length,
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

export async function listBuilds(args: { jobUrl: string; limit?: number }): Promise<{
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

  let builds = await db.myBuilds
    .filter((build) => build.jobUrl === args.jobUrl)
    .reverse()
    .sortBy('timestamp');

  if (args.limit) {
    builds = builds.slice(0, args.limit);
  }

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
    total: builds.length,
  };
}
