import { browser } from 'wxt/browser';
import type {
  BrowserAction,
  BrowserElementRef,
  BrowserElementScrollInfo,
  BrowserScrollInfo,
  BrowserSnapshot,
} from '@/lib/browserTask/types';
import { removeHighlights } from '@browser-engine-upstream/background/browser/dom/service';
import type { DOMElementNode } from '@browser-engine-upstream/background/browser/dom/views';
import Page from '@browser-engine-upstream/background/browser/page';
import type {
  BrowserContextConfig,
  PageState,
  TabInfo,
} from '@browser-engine-upstream/background/browser/views';
import { DEFAULT_BROWSER_CONTEXT_CONFIG } from '@browser-engine-upstream/background/browser/views';

const PAGE_WAIT_TIMEOUT_MS = 8000;
const SCROLL_SETTLE_INTERVAL_MS = 50;
const SCROLL_SETTLE_SAMPLES = 3;
const SCROLL_SETTLE_TIMEOUT_MS = 2000;

export interface BrowserEngineState {
  currentTabId: number;
  page: BrowserSnapshot;
  tabs: TabInfo[];
  screenshot?: string;
}

export interface BrowserEngineActResult {
  message: string;
  newTabId?: number;
  navigatedFrom?: string;
  navigatedTo?: string;
  /** 读取型动作（如下拉框选项）返回给模型的结构化数据 */
  data?: Record<string, unknown>;
}

interface ScrollInfo {
  scrollLeft: number;
  clientWidth: number;
  scrollWidth: number;
  scrollTop: number;
  clientHeight: number;
  scrollHeight: number;
}

type ScrollAxis = 'vertical' | 'horizontal';
type ScrollDirection = 'up' | 'down' | 'left' | 'right';

export class NanobrowserContext {
  private readonly pages = new Map<number, Page>();
  private currentTabId: number | null = null;
  private readonly config: BrowserContextConfig;

  constructor(config: Partial<BrowserContextConfig> = {}) {
    this.config = { ...DEFAULT_BROWSER_CONTEXT_CONFIG, ...config };
  }

  async getState(tabId?: number, useVision = false): Promise<BrowserEngineState> {
    const currentPage = await this.getCurrentPage(tabId);
    const pageState = await currentPage.getState(useVision, true);
    const tabs = await this.getTabInfos();
    return {
      currentTabId: currentPage.tabId,
      page: await toBrowserSnapshot(pageState),
      tabs,
      ...(pageState.screenshot ? { screenshot: pageState.screenshot } : {}),
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
    const scrollElement =
      action.startsWith('scroll') && action !== 'scroll_to_text'
        ? readOptionalScrollElement(payload, index, element)
        : undefined;

    if (action === 'click') {
      if (!element) throw new Error('目标元素不存在，请重新观察页面');
      if (page.isFileUploader(element)) {
        return {
          message: '目标是文件上传控件，已阻止自动点击；请调用 browser_request_user 让用户选择文件',
          data: { requiresUser: true },
        };
      }
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
    if (action === 'hover') {
      if (index === null || !element) throw new Error('目标元素不存在，请重新观察页面');
      await page.hoverElement(index);
      return { message: `已将鼠标悬停在元素 ${index} 上` };
    }
    if (action === 'inspect') {
      if (index === null || !element) throw new Error('目标元素不存在，请重新观察页面');
      return {
        message: `已获取元素 ${index} 的详细信息`,
        data: await page.inspectElement(index),
      };
    }
    if (action === 'fill') {
      if (!element) throw new Error('目标输入元素不存在，请重新观察页面');
      await page.inputTextElementNode(false, element, readString(payload, 'text'));
      return { message: '已填写目标字段' };
    }
    if (action === 'select') {
      if (index === null) throw new Error('select 需要元素 index');
      return {
        message: await page.selectDropdownOption(
          index,
          readString(payload, 'option'),
          readString(payload, 'matchBy') as 'text' | 'value'
        ),
      };
    }
    if (action === 'scroll' || action === 'scroll_page') {
      const direction = readScrollDirection(payload);
      const before = await getTargetScrollInfo(page, index, scrollElement, scrollAxis(direction));
      if (direction === 'up' && isAtTop(before)) return { message: scrollBoundary(index, '顶部') };
      if (direction === 'down' && isAtBottom(before))
        return { message: scrollBoundary(index, '底部') };
      if (direction === 'left' && isAtLeft(before))
        return { message: scrollBoundary(index, '左侧') };
      if (direction === 'right' && isAtRight(before))
        return { message: scrollBoundary(index, '右侧') };
      if (direction === 'up') await page.scrollToPreviousPage(scrollElement);
      else if (direction === 'down') await page.scrollToNextPage(scrollElement);
      else
        await page.scrollBy(
          0,
          scrollElement,
          direction === 'left' ? -before.clientWidth : before.clientWidth
        );
      return { message: await scrollResult(page, index, scrollElement, before, direction) };
    }
    if (action === 'scroll_to_percent') {
      const percent = readNumber(payload, 'percent');
      if (percent < 0 || percent > 100) throw new Error('percent 必须在 0-100 之间');
      const before = await getTargetScrollInfo(page, index, scrollElement, 'vertical');
      const target = scrollTopAtPercent(before, percent);
      if (Math.abs(before.scrollTop - target) < 1)
        return { message: `${scrollScope(index)}已在 ${percent}% 位置` };
      await page.scrollBy(target - before.scrollTop, scrollElement);
      return {
        message: await scrollResult(
          page,
          index,
          scrollElement,
          before,
          target > before.scrollTop ? 'down' : 'up'
        ),
      };
    }
    if (action === 'scroll_to_top') {
      const before = await getTargetScrollInfo(page, index, scrollElement, 'vertical');
      if (isAtTop(before)) return { message: scrollBoundary(index, '顶部') };
      await page.scrollBy(-before.scrollTop, scrollElement);
      return { message: await scrollResult(page, index, scrollElement, before, 'up') };
    }
    if (action === 'scroll_to_bottom') {
      const before = await getTargetScrollInfo(page, index, scrollElement, 'vertical');
      if (isAtBottom(before)) return { message: scrollBoundary(index, '底部') };
      await page.scrollBy(scrollTopAtPercent(before, 100) - before.scrollTop, scrollElement);
      return { message: await scrollResult(page, index, scrollElement, before, 'down') };
    }
    if (action === 'scroll_to_text') {
      const text = readString(payload, 'text');
      const nth = payload.nth === undefined ? 1 : readNumber(payload, 'nth');
      const found = await page.scrollToText(text, nth);
      return {
        message: found
          ? `已滚动到第 ${nth} 个包含「${text}」的位置`
          : `页面上未找到第 ${nth} 个「${text}」，未滚动`,
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
    if (action === 'go_forward') {
      await page.goForward();
      return { message: '已前进到下一页' };
    }
    if (action === 'refresh') {
      await page.refreshPage();
      return { message: '已刷新当前页面' };
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
    const tabIds = [...this.pages.keys()];
    await Promise.all(tabIds.map((tabId) => removeHighlights(tabId)));
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
    scroll: toBrowserScrollInfo(
      state.scrollX,
      state.scrollY,
      state.visualViewportWidth,
      state.visualViewportHeight,
      state.scrollWidth,
      state.scrollHeight
    ),
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
  const verticalScroll = getNearestScrollInfo(node, 'vertical');
  const horizontalScroll = getNearestScrollInfo(node, 'horizontal');
  const scroll: BrowserElementScrollInfo = {
    ...(verticalScroll ? { vertical: toBrowserScrollInfoFromNode(verticalScroll) } : {}),
    ...(horizontalScroll ? { horizontal: toBrowserScrollInfoFromNode(horizontalScroll) } : {}),
  };
  return {
    id: String(index),
    tag: node.tagName || '',
    role: attributes.role || '',
    text: node.getAllTextTillNextClickableElement(2).slice(0, 500),
    label,
    locator: node.getEnhancedCssSelector(),
    fingerprint: JSON.stringify(hash),
    href: attributes.href,
    fileUploader: isFileUploaderNode(node),
    ...(Object.keys(scroll).length > 0 ? { scroll } : {}),
  };
}

function getNearestScrollInfo(
  node: DOMElementNode,
  axis: ScrollAxis
): NonNullable<DOMElementNode['scrollInfo']> | undefined {
  let current: DOMElementNode | null = node;
  while (current) {
    const info = current.scrollInfo;
    if (
      info &&
      (axis === 'vertical'
        ? info.scrollHeight > info.clientHeight
        : info.scrollWidth > info.clientWidth)
    ) {
      return info;
    }
    current = current.parent;
  }
  return undefined;
}

function toBrowserScrollInfo(
  scrollLeft: number,
  scrollTop: number,
  clientWidth: number,
  clientHeight: number,
  scrollWidth: number,
  scrollHeight: number
): BrowserScrollInfo | undefined {
  if (scrollHeight <= clientHeight && scrollWidth <= clientWidth) return undefined;
  return {
    scrollLeft,
    clientWidth,
    scrollWidth,
    scrollTop,
    clientHeight,
    scrollHeight,
    canScrollLeft: scrollLeft > 1,
    canScrollRight: scrollLeft < scrollWidth - clientWidth - 1,
    canScrollUp: scrollTop > 1,
    canScrollDown: scrollTop < scrollHeight - clientHeight - 1,
  };
}

function toBrowserScrollInfoFromNode(
  info: NonNullable<DOMElementNode['scrollInfo']>
): BrowserScrollInfo {
  return {
    scrollLeft: info.scrollLeft,
    clientWidth: info.clientWidth,
    scrollWidth: info.scrollWidth,
    scrollTop: info.scrollTop,
    clientHeight: info.clientHeight,
    scrollHeight: info.scrollHeight,
    canScrollLeft: info.scrollLeft > 1,
    canScrollRight: info.scrollLeft < info.scrollWidth - info.clientWidth - 1,
    canScrollUp: info.scrollTop > 1,
    canScrollDown: info.scrollTop < info.scrollHeight - info.clientHeight - 1,
  };
}

function isFileUploaderNode(node: DOMElementNode, depth = 0): boolean {
  if (
    node.tagName?.toLowerCase() === 'input' &&
    (node.attributes.type?.toLowerCase() === 'file' || Boolean(node.attributes.accept))
  ) {
    return true;
  }
  if (depth >= 3) return false;
  return node.children.some(
    (child) => 'tagName' in child && isFileUploaderNode(child as DOMElementNode, depth + 1)
  );
}

function readIndex(payload: Record<string, unknown>): number | null {
  const value = payload.index;
  if (value === undefined) return null;
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

function readOptionalScrollElement(
  payload: Record<string, unknown>,
  index: number | null,
  element: DOMElementNode | null | undefined
): DOMElementNode | undefined {
  if (payload.index === undefined) return undefined;
  if (index === null || !element) throw new Error('滚动目标元素不存在，请重新观察页面');
  return element;
}

async function getTargetScrollInfo(
  page: Page,
  index: number | null,
  element: DOMElementNode | undefined,
  axis: ScrollAxis
): Promise<ScrollInfo> {
  if (!element) {
    const [scrollLeft, scrollTop, clientWidth, clientHeight, scrollWidth, scrollHeight] =
      await page.getScrollInfo();
    return { scrollLeft, scrollTop, clientWidth, clientHeight, scrollWidth, scrollHeight };
  }
  if (index === null) throw new Error('局部滚动需要元素 index');

  const handle = await page.getElementByIndex(index);
  if (!handle) throw new Error('滚动目标元素不存在，请重新观察页面');
  try {
    const info = await handle.evaluate((target, targetAxis) => {
      let current: Element | null = target;
      const { documentElement } = target.ownerDocument;
      while (current && current !== documentElement) {
        if (current instanceof HTMLElement) {
          const style = window.getComputedStyle(current);
          const isVertical = targetAxis === 'vertical';
          const canScroll = isVertical
            ? ['auto', 'scroll'].includes(style.overflowY) ||
              ['auto', 'scroll'].includes(style.overflow)
            : ['auto', 'scroll'].includes(style.overflowX) ||
              ['auto', 'scroll'].includes(style.overflow);
          const hasOverflow = isVertical
            ? current.scrollHeight > current.clientHeight
            : current.scrollWidth > current.clientWidth;
          if (canScroll && hasOverflow) {
            const maxScrollLeft = Math.max(0, current.scrollWidth - current.clientWidth);
            const scrollLeft =
              style.direction === 'rtl'
                ? Math.max(0, Math.min(maxScrollLeft, maxScrollLeft + current.scrollLeft))
                : current.scrollLeft;
            return {
              scrollLeft,
              clientWidth: current.clientWidth,
              scrollWidth: current.scrollWidth,
              scrollTop: current.scrollTop,
              clientHeight: current.clientHeight,
              scrollHeight: current.scrollHeight,
            };
          }
        }
        current = current.parentElement;
      }
      return null;
    }, axis);
    if (!info) {
      throw new Error(`元素 ${index} 不在局部可滚动区域；省略 index 才会滚动整个页面`);
    }
    return info;
  } finally {
    await handle.dispose();
  }
}

async function scrollResult(
  page: Page,
  index: number | null,
  element: DOMElementNode | undefined,
  before: ScrollInfo,
  direction: ScrollDirection
): Promise<string> {
  const after = await waitForScrollSettled(page, index, element, before, direction);
  if (!after) return `已滚动${scrollScope(index)}`;
  const positionChanged =
    direction === 'left' || direction === 'right'
      ? Math.abs(after.scrollLeft - before.scrollLeft) >= 1
      : Math.abs(after.scrollTop - before.scrollTop) >= 1;
  if (!positionChanged) {
    if (direction === 'up' && isAtTop(after)) return scrollBoundary(index, '顶部');
    if (direction === 'down' && isAtBottom(after)) return scrollBoundary(index, '底部');
    if (direction === 'left' && isAtLeft(after)) return scrollBoundary(index, '左侧');
    if (direction === 'right' && isAtRight(after)) return scrollBoundary(index, '右侧');
    return `${scrollScope(index)}的滚动位置未变化`;
  }
  const maxScroll =
    direction === 'left' || direction === 'right'
      ? Math.max(0, after.scrollWidth - after.clientWidth)
      : Math.max(0, after.scrollHeight - after.clientHeight);
  const position =
    direction === 'left' || direction === 'right' ? after.scrollLeft : after.scrollTop;
  const percent =
    maxScroll === 0 ? 100 : Math.max(0, Math.min(100, Math.round((position / maxScroll) * 100)));
  return `已滚动${scrollScope(index)}，当前位置约 ${percent}%`;
}

async function waitForScrollSettled(
  page: Page,
  index: number | null,
  element: DOMElementNode | undefined,
  before: ScrollInfo,
  direction: ScrollDirection
): Promise<ScrollInfo | null> {
  const axis = scrollAxis(direction);
  const deadline = Date.now() + SCROLL_SETTLE_TIMEOUT_MS;
  let previous = before;
  let stableSamples = 0;

  while (Date.now() < deadline) {
    await sleep(SCROLL_SETTLE_INTERVAL_MS);
    const current = await getTargetScrollInfo(page, index, element, axis).catch(() => null);
    if (!current) return null;
    const currentPosition = axis === 'horizontal' ? current.scrollLeft : current.scrollTop;
    const previousPosition = axis === 'horizontal' ? previous.scrollLeft : previous.scrollTop;
    stableSamples = Math.abs(currentPosition - previousPosition) < 1 ? stableSamples + 1 : 0;
    if (stableSamples >= SCROLL_SETTLE_SAMPLES) return current;
    previous = current;
  }

  return previous;
}

function isAtTop(info: ScrollInfo): boolean {
  return info.scrollTop <= 1;
}

function isAtBottom(info: ScrollInfo): boolean {
  return info.scrollTop + info.clientHeight >= info.scrollHeight - 1;
}

function isAtLeft(info: ScrollInfo): boolean {
  return info.scrollLeft <= 1;
}

function isAtRight(info: ScrollInfo): boolean {
  return info.scrollLeft + info.clientWidth >= info.scrollWidth - 1;
}

function scrollTopAtPercent(info: ScrollInfo, percent: number): number {
  return Math.max(0, info.scrollHeight - info.clientHeight) * (percent / 100);
}

function scrollScope(index: number | null): string {
  return index === null ? '页面' : `元素 ${index} 所在的局部区域`;
}

function scrollBoundary(index: number | null, boundary: '顶部' | '底部' | '左侧' | '右侧'): string {
  return `${scrollScope(index)}已在${boundary}`;
}

function scrollAxis(direction: ScrollDirection): ScrollAxis {
  return direction === 'left' || direction === 'right' ? 'horizontal' : 'vertical';
}

function readScrollDirection(payload: Record<string, unknown>): ScrollDirection {
  const direction = readString(payload, 'direction');
  if (direction === 'up' || direction === 'down' || direction === 'left' || direction === 'right') {
    return direction;
  }
  throw new Error('direction 必须是 up、down、left 或 right');
}

function readString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== 'string' || !value) throw new Error(`${key} 必须是非空字符串`);
  return value;
}

function readNumber(payload: Record<string, unknown>, key: string): number {
  const value = payload[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${key} 必须是数字`);
  return value;
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
