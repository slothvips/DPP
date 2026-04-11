import { browser } from 'wxt/browser';
import { isInjectable } from '@/lib/pageAgent/injector';
import { logger } from '@/utils/logger';

export type TabResolutionResult =
  | { success: true; tabId: number; url: string }
  | { success: false; error: string };

async function getCurrentActiveTab(): Promise<TabResolutionResult> {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];

    if (!activeTab?.id || !activeTab.url) {
      return { success: false, error: '无法获取当前标签页' };
    }

    return {
      success: true,
      tabId: activeTab.id,
      url: activeTab.url,
    };
  } catch (error) {
    logger.info('[PageAgent] 获取当前标签页失败:', error);
    return { success: false, error: '获取标签页失败' };
  }
}

async function getTabById(tabId: number): Promise<TabResolutionResult> {
  try {
    const tab = await browser.tabs.get(tabId);

    if (!tab?.url) {
      return { success: false, error: '无法获取指定标签页 URL' };
    }

    return {
      success: true,
      tabId,
      url: tab.url,
    };
  } catch {
    return { success: false, error: '无法获取指定标签页' };
  }
}

export async function resolveInjectableTab(tabId?: number): Promise<TabResolutionResult> {
  const tabResult = tabId === undefined ? await getCurrentActiveTab() : await getTabById(tabId);

  if (!tabResult.success) {
    return tabResult;
  }

  if (!isInjectable(tabResult.url)) {
    return { success: false, error: '无法在此页面使用 Page Agent' };
  }

  return tabResult;
}
