// Jenkins message handlers for background script
import { cancelBuild, getJobDetails, triggerBuild } from '@/features/jenkins/api/build';
import { fetchAllJobs } from '@/features/jenkins/api/fetchJobs';
import { fetchMyBuilds } from '@/features/jenkins/api/fetchMyBuilds';
import type { JenkinsMessage, JenkinsResponse } from '@/features/jenkins/messages';
import {
  notifyTelegramForTriggeredBuild,
  sendJenkinsTelegramMessage,
} from '@/features/jenkins/telegram';
import { getJenkinsCredentials } from '@/lib/db/jenkins';
import { logger } from '@/utils/logger';

export type { JenkinsMessage, JenkinsResponse };

/**
 * Handle Jenkins messages
 */
export async function handleJenkinsMessage(message: JenkinsMessage): Promise<JenkinsResponse> {
  try {
    let data: unknown;

    switch (message.type) {
      case 'JENKINS_FETCH_JOBS': {
        const { host, user, token, envId } = await getJenkinsCredentials();
        data = await fetchAllJobs(host, user, token, envId);
        break;
      }
      case 'JENKINS_FETCH_MY_BUILDS': {
        const { host, user, token, envId } = await getJenkinsCredentials();
        data = await fetchMyBuilds(host, user, token, envId);
        break;
      }
      case 'JENKINS_TRIGGER_BUILD': {
        const { jobUrl, jobName, parameters, envId: targetEnvId, notifyTelegram } = message.payload;
        const { host, user, token, envId } = await getJenkinsCredentials(targetEnvId);
        const buildTriggered = await triggerBuild(jobUrl, user, token, host, parameters);
        const telegramNotification = buildTriggered
          ? await notifyTelegramForTriggeredBuild({
              context: {
                jobName: jobName || jobUrl,
                jobUrl,
                envId,
                jenkinsUser: user,
                parameters,
              },
              notifyTelegram,
            })
          : undefined;

        data = { buildTriggered, telegramNotification };
        break;
      }
      case 'JENKINS_GET_JOB_DETAILS': {
        const { jobUrl, envId: targetEnvId } = message.payload;
        const { user, token } = await getJenkinsCredentials(targetEnvId);
        data = await getJobDetails(jobUrl, user, token);
        break;
      }
      case 'JENKINS_CANCEL_BUILD': {
        const { jobUrl, buildNumber, envId: targetEnvId } = message.payload;
        const { host, user, token } = await getJenkinsCredentials(targetEnvId);
        data = await cancelBuild(jobUrl, buildNumber, user, token, host);
        break;
      }
      case 'JENKINS_TEST_TELEGRAM_NOTIFICATION': {
        const { botToken, chatId } = message.payload;
        await sendJenkinsTelegramMessage(
          { botToken, chatId },
          `DPP Jenkins TG 通知测试\n时间: ${new Date().toLocaleString('zh-CN', { hour12: false })}`
        );
        data = true;
        break;
      }
    }
    return { success: true, data };
  } catch (e) {
    const err = e as Error;
    logger.error(`Jenkins action ${message.type} failed:`, err);
    return { success: false, error: err.message || String(e) };
  }
}
