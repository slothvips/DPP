import { browser } from 'wxt/browser';
import { assertJenkinsUrlAllowed, normalizeJenkinsRootUrl } from '@/features/jenkins/api/urlSafety';
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
          const activeTabs = await browser.tabs.query({ active: true, lastFocusedWindow: true });
          const activeTabId = activeTabs[0]?.id;
          if (typeof activeTabId === 'number') {
            await browser.sidePanel.open({ tabId: activeTabId });
          } else {
            await (browser.sidePanel.open as () => Promise<void>)();
          }
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
    const senderUrl = sender.tab?.url;
    const senderOrigin = senderUrl ? extractOrigin(senderUrl) : null;
    let isAllowedSource = false;
    try {
      isAllowedSource = Boolean(senderUrl && assertJenkinsUrlAllowed(senderUrl, host));
    } catch {
      isAllowedSource = false;
    }
    if (!senderOrigin || !isAllowedSource || extractOrigin(host) !== senderOrigin) {
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
      const senderUrl = sender.tab?.url;
      const senderOrigin = sender.tab?.url ? extractOrigin(sender.tab.url) : null;
      if (!senderOrigin) return { success: true, allowed: false };

      const [legacyHost, environments] = await Promise.all([
        getSetting('jenkins_host'),
        getSetting('jenkins_environments'),
      ]);
      if (!senderUrl) return { success: true, allowed: false };
      const configuredRoots: string[] = [];
      if (typeof legacyHost === 'string') {
        try {
          configuredRoots.push(normalizeJenkinsRootUrl(legacyHost));
        } catch {
          // Ignore malformed legacy configuration.
        }
      }
      if (Array.isArray(environments)) {
        for (const environment of environments) {
          const environmentRecord = environment as { host?: unknown };
          if (typeof environmentRecord.host === 'string') {
            try {
              configuredRoots.push(normalizeJenkinsRootUrl(environmentRecord.host));
            } catch {
              continue;
            }
          }
        }
      }
      return {
        success: true,
        allowed: configuredRoots.some((root) => {
          try {
            assertJenkinsUrlAllowed(senderUrl, root);
            return true;
          } catch {
            return false;
          }
        }),
      };
    })();
  }

  return undefined;
}
