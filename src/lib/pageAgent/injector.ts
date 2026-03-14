// src/lib/pageAgent/injector.ts
// PageAgent 注入逻辑
import { browser } from 'wxt/browser';
import type { PageAgentConfig } from './types';
import './types';

// 导入全局类型声明

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
 * 检测页面是否已注入 PageAgent
 */
export async function isAlreadyInjected(tabId: number): Promise<boolean> {
  try {
    const result = await browser.scripting.executeScript({
      target: { tabId },
      func: () => !!window.__DPP_PAGE_AGENT__,
    });
    return result[0]?.result === true;
  } catch {
    return false;
  }
}

/**
 * 聚焦已存在的 PageAgent Panel
 */
export async function focusExistingPanel(tabId: number): Promise<void> {
  await browser.scripting.executeScript({
    target: { tabId },
    func: () => {
      const agent = window.__DPP_PAGE_AGENT__;
      if (agent?.panel) {
        agent.panel.show();
        agent.panel.expand();
      }
    },
  });
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
      await focusExistingPanel(tabId);
      return { success: true };
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
