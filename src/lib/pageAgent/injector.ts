// src/lib/pageAgent/injector.ts
// PageAgent 注入逻辑
import { logger } from '@/utils/logger';
import {
  clearExistingAgent as clearExistingAgentAction,
  focusExistingPanel,
  injectContentScript,
  isAlreadyInjected,
} from './injectorActions';
import {
  getInjectedTabs,
  isInjectingTab,
  markTabInjected,
  markTabInjecting,
  unmarkTabInjected,
  unmarkTabInjecting,
} from './injectorRegistry';
import type { PageAgentConfig } from './types';

// 注意：registerInjectorTabLifecycle 需要在 background 上下文中显式调用
// 详见 src/entrypoints/background/backgroundLifecycle.ts

/**
 * 检测 URL 是否允许注入
 */
export function isInjectable(url: string): boolean {
  const blockedPrefixes = [
    'chrome://',
    'edge://',
    'about:',
    'chrome-extension://',
    'https://chrome.google.com/webstore',
  ];
  return !blockedPrefixes.some((prefix) => url.startsWith(prefix));
}

export { getInjectedTabs };
export { registerInjectorTabLifecycle } from './injectorRegistry';

/**
 * 清除已存在的 PageAgent 实例
 */
export async function clearExistingAgent(tabId: number): Promise<void> {
  if (typeof tabId !== 'number' || tabId < 0) {
    logger.warn('[PageAgent] Invalid tabId:', tabId);
    unmarkTabInjected(tabId);
    return;
  }

  await clearExistingAgentAction(tabId);
  unmarkTabInjected(tabId);
}

/**
 * 注入 PageAgent 到指定标签页
 * 注意：不再将敏感配置存储在 session storage 中
 * Content script 会通过消息传递直接获取配置
 */
export async function injectPageAgent(
  tabId: number,
  _config: PageAgentConfig
): Promise<{ success: boolean; error?: string }> {
  if (isInjectingTab(tabId)) {
    logger.info('[PageAgent] 正在注入中，忽略重复请求');
    return { success: true };
  }

  markTabInjecting(tabId);
  try {
    const alreadyInjected = await isAlreadyInjected(tabId);
    if (alreadyInjected) {
      const focused = await focusExistingPanel(tabId);
      if (focused) {
        markTabInjected(tabId);
        return { success: true };
      }
      await clearExistingAgent(tabId);
    }

    await injectContentScript(tabId);
    markTabInjected(tabId);
    return { success: true };
  } catch (err) {
    logger.error('[PageAgent] 注入失败:', err);
    return {
      success: false,
      error: '注入失败，请稍后重试',
    };
  } finally {
    unmarkTabInjecting(tabId);
  }
}

/**
 * 销毁所有 PageAgent 实例（用于侧边栏关闭时）
 */
export async function clearAllAgents(): Promise<void> {
  const tabs = getInjectedTabs();
  logger.info('[PageAgent] 销毁所有 PageAgent 实例, 当前数量:', tabs.length);

  const results = await Promise.allSettled(tabs.map((tabId) => clearExistingAgent(tabId)));
  const failures = results.filter((result) => result.status === 'rejected');

  if (failures.length > 0) {
    for (const result of failures) {
      if (result.status === 'rejected') {
        logger.warn('[PageAgent] 实例清理失败:', result.reason);
      }
    }
  }

  logger.info('[PageAgent] 所有 PageAgent 实例清理完成');
}
