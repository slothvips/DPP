// Jenkins message handlers for background script
import { cancelBuild, getJobDetails, triggerBuild } from '@/features/jenkins/api/build';
import { fetchAllJobs } from '@/features/jenkins/api/fetchJobs';
import { fetchMyBuilds } from '@/features/jenkins/api/fetchMyBuilds';
import type { JenkinsMessage, JenkinsResponse } from '@/features/jenkins/messages';
import { getJenkinsCredentials } from '@/lib/db/jenkins';
import { logger } from '@/utils/logger';

export type { JenkinsMessage, JenkinsResponse };

/**
 * Handle Jenkins messages
 */
export async function handleJenkinsMessage(message: JenkinsMessage): Promise<JenkinsResponse> {
  try {
    const targetEnvId = (message.payload as { envId?: string } | undefined)?.envId;
    const { host, user, token, envId } = await getJenkinsCredentials(targetEnvId);
    let data: unknown;

    switch (message.type) {
      case 'JENKINS_FETCH_JOBS':
        data = await fetchAllJobs(host, user, token, envId);
        break;
      case 'JENKINS_FETCH_MY_BUILDS':
        data = await fetchMyBuilds(host, user, token, envId);
        break;
      case 'JENKINS_TRIGGER_BUILD': {
        const { jobUrl, parameters } = message.payload;
        data = await triggerBuild(jobUrl, user, token, host, parameters);
        break;
      }
      case 'JENKINS_GET_JOB_DETAILS': {
        const { jobUrl } = message.payload;
        data = await getJobDetails(jobUrl, user, token);
        break;
      }
      case 'JENKINS_CANCEL_BUILD': {
        const { jobUrl, buildNumber } = message.payload;
        data = await cancelBuild(jobUrl, buildNumber, user, token, host);
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
