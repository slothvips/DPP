import { browser } from 'wxt/browser';
import { syncJenkinsCredentials } from '@/lib/db/jenkins';
import { getSetting } from '@/lib/db/settings';
import { logger } from '@/utils/logger';
import { extractOrigin } from '@/utils/urlSafety';

export type GeneralMessage =
  | { type: 'OPEN_SIDE_PANEL' }
  | { type: 'SAVE_JENKINS_TOKEN'; payload: { token: string; host: string; user: string } }
  | { type: 'CAPTURE_VISIBLE_TAB' }
  | { type: 'JENKINS_VALIDATE_CONTENT_ORIGIN' };

export function handleGeneralMessage(
  message: GeneralMessage,
  sender: chrome.runtime.MessageSender
): unknown {
  if (message.type === 'CAPTURE_VISIBLE_TAB') {
    return (async () => {
      try {
        const windows = await browser.windows.getAll({
          populate: false,
          windowTypes: ['normal'],
        });
        const targetWindow =
          windows.find((item) => item.focused) ??
          windows.find((item) => item.id !== undefined) ??
          null;
        if (targetWindow?.id === undefined) {
          return { success: false as const, error: '未找到可截图的浏览器窗口' };
        }

        const dataUrl = await browser.tabs.captureVisibleTab(targetWindow.id, {
          format: 'png',
        });
        return { success: true as const, dataUrl };
      } catch (error) {
        logger.error('Failed to capture visible tab:', error);
        return {
          success: false as const,
          error: error instanceof Error ? error.message : '截图失败',
        };
      }
    })();
  }

  if (message.type === 'OPEN_SIDE_PANEL') {
    return (async () => {
      try {
        if (browser.sidePanel && typeof browser.sidePanel.open === 'function') {
          await (browser.sidePanel.open as () => Promise<void>)();
        }
        return { success: true };
      } catch (error) {
        logger.error('Failed to open side panel:', error);
        return { success: false, error: '打开侧边栏失败' };
      }
    })();
  }

  if (message.type === 'SAVE_JENKINS_TOKEN') {
    const { token, host, user } = message.payload;
    const senderOrigin = sender.tab?.url ? extractOrigin(sender.tab.url) : null;
    if (!senderOrigin || extractOrigin(host) !== senderOrigin) {
      return { success: false, error: 'Jenkins Token 来源与保存地址不一致' };
    }
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

  if (message.type === 'JENKINS_VALIDATE_CONTENT_ORIGIN') {
    return (async () => {
      const senderOrigin = sender.tab?.url ? extractOrigin(sender.tab.url) : null;
      if (!senderOrigin) return { success: true, allowed: false };

      const [legacyHost, environments] = await Promise.all([
        getSetting('jenkins_host'),
        getSetting('jenkins_environments'),
      ]);
      const configuredOrigins = new Set<string>();
      const legacyOrigin = typeof legacyHost === 'string' ? extractOrigin(legacyHost) : null;
      if (legacyOrigin) configuredOrigins.add(legacyOrigin);
      if (Array.isArray(environments)) {
        for (const environment of environments) {
          const environmentRecord = environment as { host?: unknown };
          const origin =
            typeof environmentRecord.host === 'string'
              ? extractOrigin(environmentRecord.host)
              : null;
          if (origin) configuredOrigins.add(origin);
        }
      }
      return { success: true, allowed: configuredOrigins.has(senderOrigin) };
    })();
  }

  return undefined;
}
