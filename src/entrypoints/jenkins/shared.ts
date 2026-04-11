import { logger } from '@/utils/logger';

export interface JenkinsApiResponse<T = unknown> {
  data?: T;
  error?: string;
  status?: number;
  success?: boolean;
}

export async function requestJenkinsApi<T = unknown>(
  url: string,
  options?: RequestInit & { timeout?: number }
) {
  const response = (await browser.runtime.sendMessage({
    type: 'JENKINS_API_REQUEST',
    payload: { options, url },
  })) as JenkinsApiResponse<T>;

  if (!response.success) {
    throw new Error(response.error || '请求失败');
  }

  return response;
}

export async function saveJenkinsToken(token: string, userId?: string) {
  const response = (await browser.runtime.sendMessage({
    type: 'SAVE_JENKINS_TOKEN',
    payload: {
      token,
      host: location.origin,
      user: userId || location.pathname.split('/user/')[1]?.split('/')[0] || 'unknown',
    },
  })) as { success?: boolean; error?: string };

  if (!response?.success) {
    throw new Error(response?.error || '保存 Jenkins Token 失败');
  }
}

export async function getJenkinsCrumb(): Promise<{ header: string; value: string } | null> {
  const headCrumbValue =
    document.head.dataset.crumbValue || document.head.getAttribute('data-crumb-value');
  const headCrumbHeader =
    document.head.dataset.crumbHeader ||
    document.head.getAttribute('data-crumb-header') ||
    'Jenkins-Crumb';

  if (headCrumbValue) {
    return { header: headCrumbHeader, value: headCrumbValue };
  }

  try {
    const jenkinsRoot = document.head.getAttribute('data-rooturl') || '';
    const response = await requestJenkinsApi<{ crumbRequestField?: string; crumb?: string }>(
      `${jenkinsRoot}/crumbIssuer/api/json`,
      { timeout: 10000 }
    );

    if (response.data) {
      return {
        header: response.data.crumbRequestField || '',
        value: response.data.crumb || '',
      };
    }
  } catch (error) {
    logger.debug('Failed to fetch crumb via API', error);
  }

  return null;
}
