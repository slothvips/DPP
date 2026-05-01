import type {
  JenkinsMessage,
  JenkinsResponse,
  TriggerBuildMessage,
  TriggerBuildResult,
} from './messages';

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

  async triggerBuild(payload: TriggerBuildMessage['payload']): Promise<TriggerBuildResult> {
    return send<TriggerBuildResult>({
      type: 'JENKINS_TRIGGER_BUILD',
      payload,
    });
  },

  async getJobDetails(jobUrl: string, envId?: string): Promise<unknown> {
    return send<unknown>({
      type: 'JENKINS_GET_JOB_DETAILS',
      payload: { jobUrl, envId },
    });
  },

  async cancelBuild(jobUrl: string, buildNumber: number, envId?: string): Promise<boolean> {
    return send<boolean>({
      type: 'JENKINS_CANCEL_BUILD',
      payload: { jobUrl, buildNumber, envId },
    });
  },

  async testTelegramNotification(botToken: string, chatId: string): Promise<boolean> {
    return send<boolean>({
      type: 'JENKINS_TEST_TELEGRAM_NOTIFICATION',
      payload: { botToken, chatId },
    });
  },
};
