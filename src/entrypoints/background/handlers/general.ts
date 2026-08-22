import { browser } from 'wxt/browser';
import { syncJenkinsCredentials } from '@/lib/db/jenkins';
import { logger } from '@/utils/logger';

export type GeneralMessage =
  | { type: 'OPEN_SIDE_PANEL' }
  | { type: 'SAVE_JENKINS_TOKEN'; payload: { token: string; host: string; user: string } }
  | { type: 'CAPTURE_VISIBLE_TAB' };

export function handleGeneralMessage(message: GeneralMessage): unknown {
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
