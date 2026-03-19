import { browser } from 'wxt/browser';
import { updateSetting } from '@/lib/db/settings';
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
      const result = await browser.storage.session.get('__pageAgentConfig');
      const config = result.__pageAgentConfig;
      if (config) {
        await browser.storage.session.remove('__pageAgentConfig');
      }
      return { config };
    })();
  }

  if (message.type === 'PAGE_AGENT_FETCH') {
    return (async () => {
      try {
        const { url, options } = message;

        const headers = serializeHeaders(options?.headers);

        const fetchResponse = await fetch(url, {
          method: options?.method || 'POST',
          headers,
          body: options?.body,
        });

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
        await updateSetting('jenkins_host', host);
        await updateSetting('jenkins_user', user);
        await updateSetting('jenkins_token', token);
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
