// Zen and API proxy handlers for background script
import { getSetting } from '@/lib/db/settings';
import { logger } from '@/utils/logger';
import { assertFetchUrlSafe, extractHostname, resolveUrl } from '@/utils/urlSafety';

export type ProxyMessage =
  | { type: 'ZEN_FETCH_JSON'; payload: { url: string } }
  | {
      type: 'JENKINS_API_REQUEST';
      payload: {
        url: string;
        options?: {
          method?: string;
          headers?: Record<string, string>;
          body?: string;
          timeout?: number;
        };
      };
    };

interface JenkinsEnvironmentLike {
  url?: string;
  host?: string;
}

/**
 * 构建允许代理访问的 host 白名单
 *
 * 包含:
 * - 用户配置的 Jenkins 主环境 host(`jenkins_host`)
 * - 用户配置的 Jenkins 多环境 host(`jenkins_environments[].url`)
 * - sender tab 的 origin(内容脚本所在页面,用于 ZenTao/Jenkins 页面发起的同源请求)
 *
 * 这样既能防止 SSRF(攻击者无法让扩展访问白名单外的 host),
 * 又能保证现有功能正常(用户配置的内网 Jenkins/ZenTao 都在白名单内)。
 */
async function buildAllowedHosts(senderOrigin?: string): Promise<Set<string>> {
  const hosts = new Set<string>();

  try {
    const jenkinsHost = await getSetting('jenkins_host');
    if (jenkinsHost) {
      const host = extractHostname(jenkinsHost);
      if (host) hosts.add(host);
    }
  } catch (e) {
    logger.warn('[proxy] Failed to read jenkins_host setting:', e);
  }

  try {
    const jenkinsEnvs = await getSetting('jenkins_environments');
    if (Array.isArray(jenkinsEnvs)) {
      for (const env of jenkinsEnvs) {
        const envLike = env as JenkinsEnvironmentLike;
        const source = envLike.url || envLike.host;
        if (source) {
          const host = extractHostname(source);
          if (host) hosts.add(host);
        }
      }
    }
  } catch (e) {
    logger.warn('[proxy] Failed to read jenkins_environments setting:', e);
  }

  // sender tab 的 origin:内容脚本所在页面(Jenkins/ZenTao 页面)的同源 host
  // 这保证了内容脚本发起的同源请求能正常通过
  if (senderOrigin) {
    const host = extractHostname(senderOrigin);
    if (host) hosts.add(host);
  }

  return hosts;
}

/**
 * Handle Zen fetch JSON proxy
 *
 * SSRF 防护:URL 必须解析为绝对 http(s) URL,且 host 在白名单内
 * (ZenTao 页面 origin 或用户配置的 Jenkins host)
 */
export async function handleZenFetchJson(
  url: string,
  senderOrigin?: string
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    const allowedHosts = await buildAllowedHosts(senderOrigin);
    const absoluteUrl = resolveUrl(url, senderOrigin);
    if (!absoluteUrl) {
      return { success: false, error: 'Invalid URL or missing base origin' };
    }

    const safety = assertFetchUrlSafe(absoluteUrl, allowedHosts);
    if (!safety.ok) {
      logger.warn(`[proxy] ZEN_FETCH_JSON blocked: ${safety.reason}`);
      return { success: false, error: `URL not allowed: ${safety.reason}` };
    }

    const response = await fetch(absoluteUrl, { credentials: 'include' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    return { success: true, data };
  } catch (e) {
    logger.error('ZEN_FETCH_JSON failed:', e);
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Handle Jenkins API request proxy
 *
 * SSRF 防护:URL 必须解析为绝对 http(s) URL,且 host 在白名单内
 * (Jenkins 配置 host 或 Jenkins 页面 origin)
 */
export async function handleJenkinsApiRequest(
  url: string,
  options?: { method?: string; headers?: Record<string, string>; body?: string; timeout?: number },
  senderOrigin?: string
): Promise<{ success: boolean; status?: number; data?: unknown; error?: string }> {
  try {
    const allowedHosts = await buildAllowedHosts(senderOrigin);
    const absoluteUrl = resolveUrl(url, senderOrigin);
    if (!absoluteUrl) {
      return { success: false, error: 'Invalid URL or missing base origin' };
    }

    const safety = assertFetchUrlSafe(absoluteUrl, allowedHosts);
    if (!safety.ok) {
      logger.warn(`[proxy] JENKINS_API_REQUEST blocked: ${safety.reason}`);
      return { success: false, error: `URL not allowed: ${safety.reason}` };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options?.timeout || 30000);

    const response = await fetch(absoluteUrl, {
      method: options?.method || 'GET',
      headers: options?.headers,
      body: options?.body,
      signal: controller.signal,
      credentials: 'include',
    });

    clearTimeout(timeoutId);

    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
      ? await response.json()
      : await response.text();
    return { success: true, status: response.status, data };
  } catch (e) {
    logger.error('JENKINS_API_REQUEST failed:', e);
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Handle proxy messages
 *
 * 接收 sender 以提取内容脚本所在页面的 origin,用于 SSRF 白名单校验
 */
export async function handleProxyMessage(
  message: ProxyMessage,
  sender?: chrome.runtime.MessageSender
): Promise<{ success: boolean; data?: unknown; status?: number; error?: string }> {
  // sender.tab?.url 存在时表示来自内容脚本,提取其 origin 作为白名单基础
  // 用 try-catch 防御性处理:某些受限页面 url 可能无法被 URL 解析
  let senderOrigin: string | undefined;
  if (sender?.tab?.url) {
    try {
      senderOrigin = new URL(sender.tab.url).origin;
    } catch {
      logger.warn(`[proxy] Failed to parse sender tab url: ${sender.tab.url}`);
    }
  }

  switch (message.type) {
    case 'ZEN_FETCH_JSON':
      return handleZenFetchJson(message.payload.url, senderOrigin);

    case 'JENKINS_API_REQUEST':
      return handleJenkinsApiRequest(message.payload.url, message.payload.options, senderOrigin);

    default:
      return { success: false, error: 'Unknown proxy message type' };
  }
}
