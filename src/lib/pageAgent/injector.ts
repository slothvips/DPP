// src/lib/pageAgent/injector.ts
// PageAgent 注入逻辑
import { browser } from 'wxt/browser';
import { logger } from '@/utils/logger';
import type { PageAgentConfig } from './types';

// 正在注入的 tabId 集合，用于防止并发注入
const injectingTabs = new Set<number>();

// 已注入 PageAgent 的 tabId 集合，用于跟踪所有活跃实例
const injectedTabs = new Set<number>();

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

/**
 * 检测页面是否已注入 PageAgent 且面板可用
 */
export async function isAlreadyInjected(tabId: number): Promise<boolean> {
  try {
    const result = await browser.scripting.executeScript({
      target: { tabId },
      func: () => {
        const agent = window.__DPP_PAGE_AGENT__;
        if (!agent) return false;
        if (!agent.panel) return false;
        if (!agent.panel.wrapper) return false;
        if (!document.body.contains(agent.panel.wrapper)) return false;
        return true;
      },
    });
    return result[0]?.result === true;
  } catch {
    return false;
  }
}

/**
 * 尝试聚焦已存在的 PageAgent Panel
 * @returns true 如果成功显示面板，false 如果面板不可用
 */
export async function focusExistingPanel(tabId: number): Promise<boolean> {
  try {
    const result = await browser.scripting.executeScript({
      target: { tabId },
      func: () => {
        const agent = window.__DPP_PAGE_AGENT__;
        if (!agent?.panel) {
          return false;
        }
        try {
          agent.panel.show();
          agent.panel.expand();
          return true;
        } catch {
          return false;
        }
      },
    });
    return result[0]?.result === true;
  } catch {
    return false;
  }
}

/**
 * 清除已存在的 PageAgent 实例
 */
export async function clearExistingAgent(tabId: number): Promise<void> {
  // 验证 tabId 类型
  if (typeof tabId !== 'number' || tabId < 0) {
    logger.warn('[PageAgent] Invalid tabId:', tabId);
    injectedTabs.delete(tabId);
    return;
  }

  try {
    await browser.scripting.executeScript({
      target: { tabId },
      func: () => {
        const agent = window.__DPP_PAGE_AGENT__;
        if (agent) {
          agent.stop();
          delete window.__DPP_PAGE_AGENT__;
        }
      },
    });
    injectedTabs.delete(tabId);
  } catch (err) {
    logger.debug('[PageAgent] Failed to clear existing agent:', err);
    injectedTabs.delete(tabId);
  }
}

/**
 * 注入 PageAgent 到指定标签页
 */
export async function injectPageAgent(
  tabId: number,
  config: PageAgentConfig
): Promise<{ success: boolean; error?: string }> {
  // 防重入检查
  if (injectingTabs.has(tabId)) {
    logger.info('[PageAgent] 正在注入中，忽略重复请求');
    return { success: true };
  }

  injectingTabs.add(tabId);
  try {
    const alreadyInjected = await isAlreadyInjected(tabId);
    if (alreadyInjected) {
      const focused = await focusExistingPanel(tabId);
      if (focused) {
        injectedTabs.add(tabId);
        return { success: true };
      }
      await clearExistingAgent(tabId);
    }

    // 注意：API key 会短暂存储在 session storage 中（标签页级别，关闭后自动清除）
    // 这是因为 content script 需要获取配置但无法直接调用 background 函数
    // 未来考虑重构为通过消息传递，避免敏感信息存储
    await browser.storage.session.set({ __pageAgentConfig: config });

    await browser.scripting.executeScript({
      target: { tabId },
      files: ['/content-scripts/pageAgent.js'],
    });
    injectedTabs.add(tabId);
    return { success: true };
  } catch (err) {
    logger.error('[PageAgent] 注入失败:', err);
    return {
      success: false,
      error: '注入失败，请稍后重试',
    };
  } finally {
    injectingTabs.delete(tabId);
  }
}

/**
 * 获取所有已注入 PageAgent 的标签页 ID
 */
export function getInjectedTabs(): number[] {
  return Array.from(injectedTabs);
}

/**
 * 销毁所有 PageAgent 实例（用于侧边栏关闭时）
 */
export async function clearAllAgents(): Promise<void> {
  logger.info('[PageAgent] 销毁所有 PageAgent 实例, 当前数量:', injectedTabs.size);
  const tabs = Array.from(injectedTabs);
  // 使用 Promise.allSettled 确保即使部分失败，其他实例仍会被尝试清理
  const results = await Promise.allSettled(tabs.map((tabId) => clearExistingAgent(tabId)));

  // 记录失败详情
  const failures = results.filter((r) => r.status === 'rejected');
  if (failures.length > 0) {
    for (const result of failures) {
      if (result.status === 'rejected') {
        logger.warn('[PageAgent] 实例清理失败:', result.reason);
      }
    }
  }
  logger.info('[PageAgent] 所有 PageAgent 实例清理完成');
}

// 监听标签页关闭，自动从已注入集合中移除
browser.tabs.onRemoved.addListener((tabId) => {
  if (injectedTabs.has(tabId)) {
    logger.debug('[PageAgent] 标签页已关闭，移除注入记录:', tabId);
    injectedTabs.delete(tabId);
  }
  injectingTabs.delete(tabId);
});
