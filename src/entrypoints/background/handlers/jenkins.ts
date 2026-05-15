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
        const { jobUrl, parameters, envId: targetEnvId } = message.payload;
        const { host, user, token } = await getJenkinsCredentials(targetEnvId);
        data = await triggerBuild(jobUrl, user, token, host, parameters);
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
    }
    return { success: true, data };
  } catch (e) {
    const err = e as Error;
    logger.error(`Jenkins action ${message.type} failed:`, err);
    return { success: false, error: err.message || String(e) };
  }
}
