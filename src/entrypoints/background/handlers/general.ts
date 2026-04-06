import { browser } from 'wxt/browser';
import { syncJenkinsCredentials } from '@/lib/db/jenkins';
import { getAIConfig } from '@/lib/db/settings';
import { serializeHeaders } from '@/lib/pageAgent/utils';
import { logger } from '@/utils/logger';

export type GeneralMessage =
  | { type: 'PAGE_AGENT_GET_CONFIG' }
  | {
      type: 'PAGE_AGENT_FETCH';
      url: string;
      options?: { method?: string; headers?: Record<string, string>; body?: string };
    }
  | { type: 'OPEN_SIDE_PANEL' }
  | { type: 'SAVE_JENKINS_TOKEN'; payload: { token: string; host: string; user: string } };

export function handleGeneralMessage(message: GeneralMessage): unknown {
  if (message.type === 'PAGE_AGENT_GET_CONFIG') {
    return (async () => {
      // 直接从数据库获取 AI 配置（包含解密后的 API Key）
      const config = await getAIConfig();
      return { config };
    })();
  }

  if (message.type === 'PAGE_AGENT_FETCH') {
    return (async () => {
      try {
        const { url, options } = message;

        // URL 验证：只允许 http/https 协议
        let parsedUrl: URL;
        try {
          parsedUrl = new URL(url);
        } catch {
          return { success: false, error: '无效的 URL 格式' };
        }
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
          return { success: false, error: '只支持 http/https 协议的 URL' };
        }

        const headers = serializeHeaders(options?.headers);

        // 添加超时控制：30秒
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        try {
          const fetchResponse = await fetch(url, {
            method: options?.method || 'POST',
            headers,
            body: options?.body,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          const responseText = await fetchResponse.text();

          let responseBody: unknown = null;
          try {
            responseBody = responseText ? JSON.parse(responseText) : null;
          } catch {
            responseBody = responseText;
          }

          return {
            success: true,
            ok: fetchResponse.ok,
            status: fetchResponse.status,
            statusText: fetchResponse.statusText,
            headers: Object.fromEntries(fetchResponse.headers.entries()),
            body: responseBody,
          };
        } catch (fetchError) {
          clearTimeout(timeoutId);
          if (fetchError instanceof Error && fetchError.name === 'AbortError') {
            return { success: false, error: '请求超时（30秒）' };
          }
          throw fetchError;
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Fetch failed',
        };
      }
    })();
  }

  if (message.type === 'OPEN_SIDE_PANEL') {
    if (browser.sidePanel && typeof browser.sidePanel.open === 'function') {
      (browser.sidePanel.open as () => Promise<void>)();
    }
    return { success: true };
  }

  if (message.type === 'SAVE_JENKINS_TOKEN') {
    const { token, host, user } = message.payload;
    logger.debug('Received Jenkins token for:', host);

    return (async () => {
      try {
        await syncJenkinsCredentials({ host, user, token });
        logger.debug('Jenkins settings saved');
        return { success: true };
      } catch (e) {
        logger.error('Error saving settings:', e);
        return { success: false, error: String(e) };
      }
    })();
  }

  return undefined;
}
