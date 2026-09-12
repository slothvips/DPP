import { getSetting, updateSetting } from '@/lib/db/settings';

export interface JenkinsRecentJob {
  envId: string;
  url: string;
  name: string;
  at: number;
}

const MAX_RECENT_JOBS = 8;

export async function getRecentJenkinsJobs(): Promise<JenkinsRecentJob[]> {
  const stored = await getSetting('jenkins_recent_jobs');
  return Array.isArray(stored) ? stored : [];
}

export async function markRecentJenkinsJob(job: {
  envId?: string;
  url: string;
  name: string;
}): Promise<void> {
  const envId = job.envId || '';
  const current = await getRecentJenkinsJobs();
  const next: JenkinsRecentJob[] = [
    { envId, url: job.url, name: job.name, at: Date.now() },
    ...current.filter((item) => !(item.url === job.url && item.envId === envId)),
  ].slice(0, MAX_RECENT_JOBS);
  await updateSetting('jenkins_recent_jobs', next);
}
