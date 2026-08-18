import { browser } from 'wxt/browser';
import type { PageControlMessage, TabControlMessage } from '@/lib/pageAgent/multiPageTypes';
import { logger } from '@/utils/logger';

type TabsGroupingApi = typeof browser.tabs & {
  group?: (options: { tabIds: number[]; groupId?: number }) => Promise<number>;
};

export async function handlePageAgentRemoteMessage(
  message: PageControlMessage | TabControlMessage
): Promise<unknown> {
  if (message.type === 'PAGE_AGENT_PAGE_CONTROL') {
    return forwardPageControl(message);
  }

  const { action, payload } = message;
  switch (action) {
    case 'get_tab_info':
      return browser.tabs.get(readNumber(payload, 'tabId'));
    case 'get_window_tabs':
      return {
        success: true,
        tabs: await browser.tabs.query({ windowId: readNumber(payload, 'windowId') }),
      };
    case 'open_new_tab': {
      const tab = await browser.tabs.create({
        url: readString(payload, 'url'),
        windowId: readNumber(payload, 'windowId'),
        openerTabId: readOptionalNumber(payload, 'openerTabId'),
        active: false,
      });
      return { success: true, tabId: tab.id };
    }
    case 'close_tab':
      await browser.tabs.remove(readNumber(payload, 'tabId'));
      return { success: true };
    case 'group_tabs': {
      const tabsApi = browser.tabs as unknown as TabsGroupingApi;
      if (typeof tabsApi.group !== 'function') {
        logger.warn('[PageAgent] tabs.group API unavailable; tab grouping is disabled');
        return { success: true, groupId: null };
      }
      const groupId = readNumber(payload, 'groupId');
      const tabIds = readNumberArray(payload, 'tabIds') as [number, ...number[]];
      const actualGroupId =
        groupId === -1 ? await tabsApi.group({ tabIds }) : await tabsApi.group({ tabIds, groupId });
      return { success: true, groupId: actualGroupId };
    }
    case 'update_tab_group': {
      const tabGroupsApi = browser.tabGroups;
      if (!tabGroupsApi?.update) {
        logger.warn('[PageAgent] tabGroups.update API unavailable; tab group naming is disabled');
        return { success: true };
      }
      await tabGroupsApi.update(readNumber(payload, 'groupId'), {
        title: readString(payload, 'title'),
        color: readTabGroupColor(payload, 'color'),
        collapsed: false,
      });
      return { success: true };
    }
  }
}

async function forwardPageControl(message: PageControlMessage): Promise<unknown> {
  try {
    return await browser.tabs.sendMessage(message.targetTabId, message);
  } catch (error) {
    if (!isReceivingEndError(error)) throw error;
    await browser.scripting.executeScript({
      target: { tabId: message.targetTabId },
      files: ['/content-scripts/pageAgentController.js'],
    });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        await browser.tabs.sendMessage(message.targetTabId, {
          type: 'PAGE_AGENT_PAGE_CONTROLLER_READY',
        });
        return await browser.tabs.sendMessage(message.targetTabId, message);
      } catch (retryError) {
        if (!isReceivingEndError(retryError) || attempt === 4) throw retryError;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    throw new Error('PageController 未准备就绪');
  }
}

function isReceivingEndError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /Receiving end does not exist|Could not establish connection/i.test(error.message)
  );
}

function readNumber(payload: Record<string, unknown>, key: string): number {
  const value = payload[key];
  if (typeof value !== 'number') throw new Error(`${key} 必须是数字`);
  return value;
}

function readOptionalNumber(payload: Record<string, unknown>, key: string): number | undefined {
  const value = payload[key];
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'number') throw new Error(`${key} 必须是数字`);
  return value;
}

function readString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== 'string') throw new Error(`${key} 必须是字符串`);
  return value;
}

function readNumberArray(payload: Record<string, unknown>, key: string): number[] {
  const value = payload[key];
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'number')) {
    throw new Error(`${key} 必须是数字数组`);
  }
  return value as [number, ...number[]];
}

function readTabGroupColor(
  payload: Record<string, unknown>,
  key: string
): chrome.tabGroups.TabGroup['color'] {
  const value = payload[key];
  const colors: chrome.tabGroups.TabGroup['color'][] = [
    'grey',
    'blue',
    'red',
    'yellow',
    'green',
    'pink',
    'purple',
    'cyan',
  ];
  if (typeof value !== 'string' || !colors.includes(value as chrome.tabGroups.TabGroup['color'])) {
    throw new Error(`${key} 不是有效的标签页分组颜色`);
  }
  return value as chrome.tabGroups.TabGroup['color'];
}
