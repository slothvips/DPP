import { http } from '@/lib/http';
import { logger } from '@/utils/logger';

interface AutoDetectResult {
  host: string;
  user: string;
  token: string;
  name: string;
}

export async function autoDetectJenkinsEnv(
  hostInput: string,
  confirmOpenLogin: (message: string) => Promise<boolean>
): Promise<AutoDetectResult | null> {
  let url = hostInput;
  if (!url) {
    throw new Error('请先输入服务器地址');
  }

  if (!url.startsWith('http')) {
    url = `http://${url}`;
  }
  url = url.replace(/\/$/, '');

  const userRes = await http(`${url}/me/api/json?tree=id`, { timeout: 15000 });

  if (userRes.status === 403 || userRes.status === 401) {
    const confirmed = await confirmOpenLogin('需要认证。是否打开 Jenkins 登录页面？');
    if (confirmed) {
      window.open(url, '_blank');
    }
    return null;
  }

  if (!userRes.ok) {
    throw new Error(`连接失败 (${userRes.status})`);
  }

  const userData = (await userRes.json()) as { id?: string };
  const userId = userData.id;

  if (userId === 'anonymous') {
    const confirmed = await confirmOpenLogin('当前为"匿名"登录。是否打开 Jenkins 登录页面？');
    if (confirmed) {
      window.open(`${url}/login`, '_blank');
    }
    return null;
  }

  let crumbHeader = 'Jenkins-Crumb';
  let crumbValue = '';
  try {
    const crumbRes = await http(`${url}/crumbIssuer/api/json`, { timeout: 10000 });
    if (crumbRes.ok) {
      const crumbData = (await crumbRes.json()) as {
        crumbRequestField?: string;
        crumb?: string;
      };
      crumbHeader = crumbData.crumbRequestField || 'Jenkins-Crumb';
      crumbValue = crumbData.crumb || '';
    }
  } catch (error) {
    logger.warn('Could not fetch crumb, trying without...', error);
  }

  const generateUrl = `${url}/user/${userId}/descriptorByName/jenkins.security.ApiTokenProperty/generateNewToken`;
  const params = new URLSearchParams();
  params.append('newTokenName', `DPP Extension ${new Date().toISOString().slice(0, 10)}`);

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/json',
  };
  if (crumbValue) {
    headers[crumbHeader] = crumbValue;
  }

  const genRes = await http(generateUrl, {
    method: 'POST',
    headers,
    body: params,
    timeout: 15000,
  });

  if (!genRes.ok) {
    throw new Error(`令牌生成失败: ${genRes.status}`);
  }

  const genData = (await genRes.json()) as {
    status?: string;
    data?: { tokenValue?: string };
  };
  if (genData.status !== 'ok' || !genData.data?.tokenValue) {
    throw new Error('Jenkins 响应无效');
  }

  return {
    host: url,
    user: userId || '',
    token: genData.data.tokenValue,
    name: userId ? `${userId} @ ${new URL(url).hostname}` : 'New Env',
  };
}
