import type { JenkinsMessage, JenkinsResponse } from './messages';

async function send<T>(message: JenkinsMessage): Promise<T> {
  const response = (await browser.runtime.sendMessage(message)) as JenkinsResponse<T>;
  if (!response) {
    throw new Error('Failed to communicate with background service');
  }
  if (!response.success) {
    throw new Error(response.error || 'Unknown error');
  }
  return response.data as T;
}

export const JenkinsService = {
  async fetchAllJobs(): Promise<number> {
    return send<number>({ type: 'JENKINS_FETCH_JOBS' });
  },

  async fetchMyBuilds(): Promise<number> {
    return send<number>({ type: 'JENKINS_FETCH_MY_BUILDS' });
  },

  async triggerBuild(
    jobUrl: string,
    parameters?: Record<string, string | boolean | number>
  ): Promise<boolean> {
    return send<boolean>({
      type: 'JENKINS_TRIGGER_BUILD',
      payload: { jobUrl, parameters },
    });
  },

  async getJobDetails(jobUrl: string): Promise<unknown> {
    return send<unknown>({
      type: 'JENKINS_GET_JOB_DETAILS',
      payload: { jobUrl },
    });
  },
};
