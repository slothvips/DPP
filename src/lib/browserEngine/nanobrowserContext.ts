import { browser } from 'wxt/browser';
import type { BrowserAction, BrowserElementRef, BrowserSnapshot } from '@/lib/browserTask/types';
import type { DOMElementNode } from '@browser-engine-upstream/background/browser/dom/views';
import Page from '@browser-engine-upstream/background/browser/page';
import type {
  BrowserContextConfig,
  PageState,
  TabInfo,
} from '@browser-engine-upstream/background/browser/views';
import { DEFAULT_BROWSER_CONTEXT_CONFIG } from '@browser-engine-upstream/background/browser/views';

const PAGE_WAIT_TIMEOUT_MS = 8000;

export interface BrowserEngineState {
  currentTabId: number;
  page: BrowserSnapshot;
  tabs: TabInfo[];
}

export interface BrowserEngineActResult {
  message: string;
  newTabId?: number;
  navigatedFrom?: string;
  navigatedTo?: string;
  /** 读取型动作（如下拉框选项）返回给模型的结构化数据 */
  data?: Record<string, unknown>;
}

export class NanobrowserContext {
  private readonly pages = new Map<number, Page>();
  private currentTabId: number | null = null;
  private readonly config: BrowserContextConfig;

  constructor(config: Partial<BrowserContextConfig> = {}) {
    this.config = { ...DEFAULT_BROWSER_CONTEXT_CONFIG, ...config };
  }

  async getState(tabId?: number): Promise<BrowserEngineState> {
    const currentPage = await this.getCurrentPage(tabId);
    const pageState = await currentPage.getState(false, true);
    const tabs = await this.getTabInfos();
    return {
      currentTabId: currentPage.tabId,
      page: await toBrowserSnapshot(pageState),
      tabs,
    };
  }

  async act(
    tabId: number,
    action: BrowserAction,
    payload: Record<string, unknown>
  ): Promise<BrowserEngineActResult> {
    const page = await this.getCurrentPage(tabId);
    const state = await page.getState(false, true);
    const index = readIndex(payload);
    const element = index === null ? null : state.selectorMap.get(index);

    if (action === 'click') {
      if (!element) throw new Error('目标元素不存在，请重新观察页面');
      const tabIdsBefore = await this.getWindowTabIds(tabId);
      let clickError: unknown;
      try {
        await page.clickElementNode(false, element);
      } catch (error) {
        clickError = error;
      }
      const newTabId = await this.detectNewTab(tabId, tabIdsBefore);
      if (newTabId !== null) {
        // 新标签页先处于 about:blank，等真实 URL 提交后再创建 Page，
        // 否则 Page 会以无效 URL 构造并被判定为永远不可连接
        await waitForUsableTab(newTabId).catch(() => undefined);
        this.currentTabId = newTabId;
        return { message: '已点击目标元素，并切换到新打开的标签页', newTabId };
      }
      if (clickError) {
        const currentTab = await browser.tabs.get(tabId).catch(() => null);
        if (currentTab?.url && currentTab.url !== state.url) {
          return {
            message: `点击已触发页面导航到 ${currentTab.url}`,
            navigatedFrom: state.url,
            navigatedTo: currentTab.url,
          };
        }
        throw clickError;
      }
      return { message: '已点击目标元素' };
    }
    if (action === 'fill') {
      if (!element) throw new Error('目标输入元素不存在，请重新观察页面');
      await page.inputTextElementNode(false, element, readString(payload, 'text'));
      return { message: '已填写目标字段' };
    }
    if (action === 'select') {
      if (index === null) throw new Error('select 需要元素 index');
      return { message: await page.selectDropdownOption(index, readString(payload, 'option')) };
    }
    if (action === 'scroll') {
      const [, , viewportHeight] = await page.getScrollInfo();
      const direction = readString(payload, 'direction');
      await page.scrollBy(
        direction === 'up' ? -viewportHeight : viewportHeight,
        element || undefined
      );
      return { message: '已滚动页面' };
    }
    if (action === 'scroll_to_percent') {
      const percent = clampPercent(readNumber(payload, 'percent'));
      await page.scrollToPercent(percent, element || undefined);
      return { message: `已滚动到页面 ${percent}% 位置` };
    }
    if (action === 'scroll_to_top') {
      await page.scrollToPercent(0, element || undefined);
      return { message: '已滚动到页面顶部' };
    }
    if (action === 'scroll_to_bottom') {
      await page.scrollToPercent(100, element || undefined);
      return { message: '已滚动到页面底部' };
    }
    if (action === 'scroll_page') {
      const direction = readString(payload, 'direction');
      if (direction === 'up') await page.scrollToPreviousPage(element || undefined);
      else await page.scrollToNextPage(element || undefined);
      return { message: direction === 'up' ? '已向上翻页滚动' : '已向下翻页滚动' };
    }
    if (action === 'scroll_to_text') {
      const text = readString(payload, 'text');
      const found = await page.scrollToText(text);
      return {
        message: found ? `已滚动到包含「${text}」的位置` : `页面上未找到「${text}」，未滚动`,
      };
    }
    if (action === 'send_keys') {
      const keys = readString(payload, 'keys');
      await page.sendKeys(keys);
      return { message: `已发送按键 ${keys}` };
    }
    if (action === 'get_dropdown_options') {
      if (index === null) throw new Error('获取下拉框选项需要元素 index');
      const options = await page.getDropdownOptions(index);
      return { message: `下拉框共有 ${options.length} 个选项`, data: { options } };
    }
    if (action === 'navigate') {
      const url = readString(payload, 'url');
      const urlBefore = state.url;
      await page.navigateTo(url);
      return { message: `已导航到 ${url}`, navigatedFrom: urlBefore, navigatedTo: url };
    }
    if (action === 'go_back') {
      await page.goBack();
      return { message: '已返回上一页' };
    }
    throw new Error(`浏览器内核不支持动作 ${action}`);
  }

  private async getWindowTabIds(sourceTabId: number): Promise<Set<number>> {
    const sourceTab = await browser.tabs.get(sourceTabId);
    const tabs = await browser.tabs.query({ windowId: sourceTab.windowId });
    return new Set(tabs.flatMap((tab) => (tab.id !== undefined ? [tab.id] : [])));
  }

  private async detectNewTab(
    sourceTabId: number,
    tabIdsBefore: Set<number>
  ): Promise<number | null> {
    let fallbackTabId: number | null = null;
    for (let attempt = 0; attempt < 15; attempt += 1) {
      const tabIdsAfter = await this.getWindowTabIds(sourceTabId);
      for (const tabId of tabIdsAfter) {
        if (tabIdsBefore.has(tabId)) continue;
        const tab = await browser.tabs.get(tabId).catch(() => null);
        if (tab?.openerTabId === sourceTabId) return tabId;
        fallbackTabId ??= tabId;
      }
      await sleep(100);
    }
    return fallbackTabId;
  }

  async openTab(url: string): Promise<number> {
    const tab = await browser.tabs.create({ url, active: true });
    if (tab.id === undefined) throw new Error('新标签页没有 ID');
    await waitForUsableTab(tab.id);
    const page = await this.createPage(tab.id);
    await page.attachPuppeteer();
    this.currentTabId = tab.id;
    return tab.id;
  }

  async switchTab(tabId: number): Promise<void> {
    await browser.tabs.update(tabId, { active: true });
    await waitForUsableTab(tabId);
    const page = await this.createPage(tabId);
    await page.attachPuppeteer();
    this.currentTabId = tabId;
  }

  async closeTab(tabId: number, fallbackTabId: number): Promise<void> {
    const page = this.pages.get(tabId);
    await page?.detachPuppeteer();
    this.pages.delete(tabId);
    await browser.tabs.remove(tabId);
    if (this.currentTabId === tabId) {
      await this.switchTab(fallbackTabId);
    }
  }

  async cleanup(): Promise<void> {
    for (const page of this.pages.values()) await page.detachPuppeteer().catch(() => undefined);
    this.pages.clear();
    this.currentTabId = null;
  }

  private async getCurrentPage(tabId?: number): Promise<Page> {
    const targetTabId = tabId ?? this.currentTabId ?? (await getActiveTabId());
    if (targetTabId === null) throw new Error('当前没有可控制的标签页');
    const page = await this.createPage(targetTabId);
    if (!page.validWebPage) throw new Error('当前页面不是可操作的网页（仅支持 http/https）');
    if (!page.attached && !(await page.attachPuppeteer())) {
      throw new Error('无法通过 CDP 连接到当前标签页，请重试或检查是否有其他调试工具占用');
    }
    this.currentTabId = targetTabId;
    return page;
  }

  private async createPage(tabId: number): Promise<Page> {
    const tab = await browser.tabs.get(tabId);
    const url = tab.url || '';
    const existing = this.pages.get(tabId);
    if (existing && existing.validWebPage === isWebPageUrl(url)) return existing;
    // 缓存的 Page 与当前 URL 有效性不一致（如在 about:blank 与真实页面间导航）：
    // 上游 Page 在构造时一次性判定 validWebPage，必须丢弃旧实例重建
    if (existing) await existing.detachPuppeteer().catch(() => undefined);
    const page = new Page(tabId, url, tab.title || '', this.config);
    this.pages.set(tabId, page);
    return page;
  }

  private async getTabInfos(): Promise<TabInfo[]> {
    const tabs = await browser.tabs.query({ currentWindow: true });
    return tabs.flatMap((tab) =>
      tab.id !== undefined && tab.url && tab.title
        ? [{ id: tab.id, url: tab.url, title: tab.title }]
        : []
    );
  }
}

async function toBrowserSnapshot(state: PageState): Promise<BrowserSnapshot> {
  const elements: BrowserElementRef[] = [];
  for (const [index, node] of state.selectorMap.entries()) {
    elements.push(await toElementRef(index, node));
  }
  return {
    url: state.url,
    title: state.title,
    text: state.elementTree.getAllTextTillNextClickableElement().slice(0, 12000),
    elements,
    readiness: {
      documentReadyState: 'complete',
      stable: true,
      stableForMs: 0,
      observedAt: Date.now(),
    },
  };
}

async function toElementRef(index: number, node: DOMElementNode): Promise<BrowserElementRef> {
  const attributes = node.attributes || {};
  const label =
    attributes['aria-label'] || attributes.placeholder || attributes.name || attributes.title || '';
  const hash = await node.hash();
  return {
    id: String(index),
    tag: node.tagName || '',
    role: attributes.role || '',
    text: node.getAllTextTillNextClickableElement(2).slice(0, 500),
    label,
    locator: node.getEnhancedCssSelector(),
    fingerprint: JSON.stringify(hash),
    href: attributes.href,
  };
}

function readIndex(payload: Record<string, unknown>): number | null {
  const value = payload.index;
  if (typeof value !== 'string' || !value) return null;
  const index = Number(value);
  return Number.isInteger(index) ? index : null;
}

function readString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== 'string' || !value) throw new Error(`${key} 必须是非空字符串`);
  return value;
}

function readNumber(payload: Record<string, unknown>, key: string): number {
  const value = payload[key];
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) throw new Error(`${key} 必须是数字`);
  return num;
}

function clampPercent(percent: number): number {
  return Math.min(100, Math.max(0, Math.round(percent)));
}

async function getActiveTabId(): Promise<number | null> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab?.id ?? null;
}

async function waitForUsableTab(tabId: number): Promise<void> {
  const deadline = Date.now() + PAGE_WAIT_TIMEOUT_MS;
  let lastUrl = '';
  let lastStatus: string | undefined;
  while (Date.now() < deadline) {
    const tab = await browser.tabs.get(tabId).catch(() => null);
    if (!tab) throw new Error(`标签页 ${tabId} 已不存在`);
    lastUrl = tab.url || '';
    lastStatus = tab.status;
    if (isWebPageUrl(tab.url || '') && tab.status === 'complete') return;
    await sleep(200);
  }
  throw new Error(
    `标签页 ${tabId} 等待可用超时：url=${lastUrl || '(空)'}，status=${lastStatus || '(未知)'}`
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isWebPageUrl(url: string): boolean {
  const lower = url.trim().toLowerCase();
  return lower.startsWith('http') && !lower.startsWith('https://chromewebstore.google.com');
}
