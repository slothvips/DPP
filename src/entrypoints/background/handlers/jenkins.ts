// Jenkins message handlers for background script
// Import JenkinsEnvironment type for credentials function
import type { JenkinsEnvironment } from '@/db';
import { cancelBuild, getJobDetails, triggerBuild } from '@/features/jenkins/api/build';
import { fetchAllJobs } from '@/features/jenkins/api/fetchJobs';
import { fetchMyBuilds } from '@/features/jenkins/api/fetchMyBuilds';
import type { JenkinsMessage, JenkinsResponse } from '@/features/jenkins/messages';
import { getSetting } from '@/lib/db/settings';
import { logger } from '@/utils/logger';

export type { JenkinsMessage, JenkinsResponse };

export interface JenkinsCredentials {
  host: string;
  user: string;
  token: string;
  envId: string;
}

/**
 * Get Jenkins credentials for the specified environment
 */
export async function getJenkinsCredentials(targetEnvId?: string): Promise<JenkinsCredentials> {
  const currentEnvId = await getSetting<string>('jenkins_current_env');
  const environments = (await getSetting<JenkinsEnvironment[]>('jenkins_environments')) || [];

  if (targetEnvId) {
    const env = environments.find((e) => e.id === targetEnvId);
    if (!env) {
      throw new Error(`Jenkins environment not found: ${targetEnvId}`);
    }
    return { host: env.host, user: env.user, token: env.token, envId: env.id };
  }

  if (currentEnvId && environments.length > 0) {
    const env = environments.find((e) => e.id === currentEnvId);
    if (env) {
      return { host: env.host, user: env.user, token: env.token, envId: env.id };
    }
  }

  // Fallback to legacy settings
  const host = await getSetting<string>('jenkins_host');
  const user = await getSetting<string>('jenkins_user');
  const token = await getSetting<string>('jenkins_token');

  if (!host || !user || !token) throw new Error('Jenkins credentials not configured');

  return { host, user, token, envId: 'default' };
}

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
