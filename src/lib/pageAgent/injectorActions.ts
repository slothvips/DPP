import { browser } from 'wxt/browser';
import { logger } from '@/utils/logger';

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

export async function clearExistingAgent(tabId: number): Promise<void> {
  if (typeof tabId !== 'number' || tabId < 0) {
    logger.warn('[PageAgent] Invalid tabId:', tabId);
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
  } catch (err) {
    logger.debug('[PageAgent] Failed to clear existing agent:', err);
  }
}

export async function injectContentScript(tabId: number): Promise<void> {
  await browser.scripting.executeScript({
    target: { tabId },
    files: ['/content-scripts/pageAgent.js'],
  });
}
