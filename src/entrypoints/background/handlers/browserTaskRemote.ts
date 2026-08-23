import { browser } from 'wxt/browser';
import type { BrowserControlMessage, BrowserControlResponse } from '@/lib/browserTask/types';
import { logger } from '@/utils/logger';

export async function handleBrowserTaskRemoteMessage(
  message: BrowserControlMessage
): Promise<BrowserControlResponse | unknown> {
  if (message.action !== 'get_readiness') {
    throw new Error(`后台不接受未经任务授权的标签页操作：${message.action}`);
  }

  try {
    return await browser.tabs.sendMessage(message.targetTabId, message);
  } catch (error) {
    if (!isReceivingEndError(error)) throw error;
    await browser.scripting.executeScript({
      target: { tabId: message.targetTabId },
      files: ['/content-scripts/browserController.js'],
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    return browser.tabs.sendMessage(message.targetTabId, message);
  }
}

function isReceivingEndError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  if (/Receiving end does not exist|Could not establish connection/i.test(message)) return true;
  logger.debug('[BrowserTask] 页面消息失败:', error);
  return false;
}
