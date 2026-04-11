import { browser } from 'wxt/browser';
import { logger } from '@/utils/logger';

const injectingTabs = new Set<number>();
const injectedTabs = new Set<number>();

export function isInjectingTab(tabId: number): boolean {
  return injectingTabs.has(tabId);
}

export function markTabInjecting(tabId: number) {
  injectingTabs.add(tabId);
}

export function unmarkTabInjecting(tabId: number) {
  injectingTabs.delete(tabId);
}

export function markTabInjected(tabId: number) {
  injectedTabs.add(tabId);
}

export function unmarkTabInjected(tabId: number) {
  injectedTabs.delete(tabId);
}

export function getInjectedTabs(): number[] {
  return Array.from(injectedTabs);
}

export function registerInjectorTabLifecycle() {
  browser.tabs.onRemoved.addListener((tabId) => {
    if (injectedTabs.has(tabId)) {
      logger.debug('[PageAgent] 标签页已关闭，移除注入记录:', tabId);
      injectedTabs.delete(tabId);
    }
    injectingTabs.delete(tabId);
  });
}
