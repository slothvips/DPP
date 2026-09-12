import { normalizeJenkinsRootUrl } from '@/features/jenkins/api/urlSafety';

export async function saveJenkinsToken(token: string, userId?: string) {
  const rootUrl = getJenkinsRootUrl();
  const response = (await browser.runtime.sendMessage({
    type: 'SAVE_JENKINS_TOKEN',
    payload: {
      token,
      host: rootUrl,
      user: userId || location.pathname.split('/user/')[1]?.split('/')[0] || 'unknown',
    },
  })) as { success?: boolean; error?: string };

  if (!response?.success) {
    throw new Error(response?.error || '保存 Jenkins Token 失败');
  }
}

export function getJenkinsRootUrl(): string {
  const configuredRoot = document.head.getAttribute('data-rooturl') || location.origin;
  return normalizeJenkinsRootUrl(new URL(configuredRoot, location.origin).href);
}
