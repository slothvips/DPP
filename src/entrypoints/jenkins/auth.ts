import { logger } from '@/utils/logger';
import { getJenkinsCrumb, requestJenkinsApi, saveJenkinsToken } from './shared';
import { showJenkinsNotification } from './ui';

export async function generateJenkinsToken(userId: string, tokenName: string): Promise<string> {
  const crumb = await getJenkinsCrumb();
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/json',
  };

  if (crumb) {
    headers[crumb.header] = crumb.value;
  }

  const endpoint = `${location.origin}/user/${userId}/descriptorByName/jenkins.security.ApiTokenProperty/generateNewToken`;
  const params = new URLSearchParams();
  params.append('newTokenName', tokenName);

  const response = await requestJenkinsApi<{
    status?: string;
    data?: { tokenValue?: string };
  }>(endpoint, {
    method: 'POST',
    headers,
    body: params.toString(),
    timeout: 15000,
  });

  if (response.status && response.status >= 400) {
    throw new Error(`Token 生成失败 (${response.status})`);
  }

  if (response.data?.status !== 'ok' || !response.data.data?.tokenValue) {
    throw new Error('Jenkins 返回了无效的 Token 响应');
  }

  return response.data.data.tokenValue;
}

export async function runJenkinsHeadlessAuth() {
  try {
    showJenkinsNotification('🔄 DPP: 正在连接 Jenkins...', false);

    const userResponse = await requestJenkinsApi<{ id?: string }>(
      `${location.origin}/me/api/json?tree=id`,
      {
        timeout: 15000,
      }
    );

    if (userResponse.status === 403 || userResponse.status === 401) {
      throw new Error('请先登录 Jenkins。');
    }

    if (userResponse.status && userResponse.status >= 400) {
      throw new Error('无法识别 Jenkins 用户。');
    }

    const userId = userResponse.data?.id;
    if (!userId) {
      throw new Error('无法获取用户 ID。');
    }

    const token = await generateJenkinsToken(userId, 'DPP Extension Auto');
    await saveJenkinsToken(token, userId);

    showJenkinsNotification('✅ Token 已生成并保存！正在关闭...', false);
    setTimeout(() => {
      window.close();
    }, 1500);
  } catch (error) {
    logger.debug('DPP Auth Failed:', error);
    showJenkinsNotification(
      `❌ 错误: ${error instanceof Error ? error.message : String(error)}`,
      true
    );
  }
}
