// src/lib/pageAgent/injector.ts
// PageAgent 注入逻辑
import { browser } from 'wxt/browser';
import type { PageAgentConfig } from './types';

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
  try {
    await browser.scripting.executeScript({
      target: { tabId },
      func: () => {
        delete window.__DPP_PAGE_AGENT__;
      },
    });
  } catch {
    // ignore
  }
}

/**
 * 注入 PageAgent 到指定标签页
 */
export async function injectPageAgent(
  tabId: number,
  config: PageAgentConfig
): Promise<{ success: boolean; error?: string }> {
  try {
    const alreadyInjected = await isAlreadyInjected(tabId);
    if (alreadyInjected) {
      const focused = await focusExistingPanel(tabId);
      if (focused) {
        return { success: true };
      }
      await clearExistingAgent(tabId);
    }

    await browser.storage.session.set({ __pageAgentConfig: config });

    await browser.scripting.executeScript({
      target: { tabId },
      files: ['/content-scripts/pageAgent.js'],
    });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '注入失败',
    };
  }
}
