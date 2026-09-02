import { browser } from 'wxt/browser';
import { isInjectable } from './utils';

interface TrackedTab {
  id: number;
  initial: boolean;
  url?: string;
  title?: string;
  status?: string;
}

const TAB_LOAD_TIMEOUT_MS = 30_000;
const TAB_LOAD_POLL_INTERVAL_MS = 150;

export class TabsController {
  currentTabId: number | null = null;
  private readonly initialTabId: number;
  private windowId: number | null = null;
  private groupId: number | null = null;
  private tabs: TrackedTab[] = [];

  constructor(initialTabId: number) {
    this.initialTabId = initialTabId;
  }

  async init(task: string): Promise<void> {
    await this.waitUntilTabLoaded(this.initialTabId, true);
    const tab = await browser.tabs.get(this.initialTabId);
    if (!tab.url || !isInjectable(tab.url) || tab.windowId === undefined) {
      throw new Error('当前起始标签页无法运行网页助手');
    }
    this.windowId = tab.windowId;
    this.currentTabId = this.initialTabId;
    this.tabs = [
      { id: this.initialTabId, initial: true, url: tab.url, title: tab.title, status: tab.status },
    ];
    const tabsApi = browser.tabs as typeof browser.tabs & {
      group?: (options: { tabIds: number[] }) => Promise<number>;
    };
    if (typeof tabsApi.group === 'function') {
      try {
        if (typeof tab.groupId === 'number' && tab.groupId >= 0 && browser.tabGroups) {
          const existingGroup = await browser.tabGroups.get(tab.groupId);
          if (existingGroup.title?.startsWith('DPP · ')) this.groupId = tab.groupId;
        }
        this.groupId ??= await tabsApi.group({ tabIds: [this.initialTabId] });
        await browser.tabGroups?.update(this.groupId, {
          title: `DPP · ${task.slice(0, 32)}`,
          color: 'blue',
          collapsed: false,
        });
      } catch {
        this.groupId = null;
      }
    }
  }

  async openNewTab(url: string): Promise<string> {
    if (this.windowId === null) throw new Error('标签页控制器尚未初始化');
    if (!isInjectable(url)) throw new Error('只能打开 HTTP 或 HTTPS 网页');
    const tab = await browser.tabs.create({
      url,
      windowId: this.windowId,
      openerTabId: this.currentTabId ?? undefined,
      active: false,
    });
    if (tab.id === undefined) throw new Error('无法打开新的任务标签页');
    this.tabs.push({ id: tab.id, initial: false, url, status: 'loading' });
    if (this.groupId !== null) {
      const tabsApi = browser.tabs as typeof browser.tabs & {
        group?: (options: { tabIds: number[]; groupId: number }) => Promise<number>;
      };
      await tabsApi.group?.({ tabIds: [tab.id], groupId: this.groupId });
    }
    this.currentTabId = tab.id;
    await this.waitUntilTabLoaded(tab.id, true);
    const loadedTab = await browser.tabs.get(tab.id);
    if (!loadedTab.url || !isInjectable(loadedTab.url)) {
      await browser.tabs.remove(tab.id).catch(() => undefined);
      this.tabs = this.tabs.filter((tracked) => tracked.id !== tab.id);
      this.currentTabId = this.initialTabId;
      throw new Error('新标签页跳转到了不受支持的页面');
    }
    return `已打开任务标签页 ${tab.id}，并切换到该页面：${url}`;
  }

  async switchToTab(tabId: number): Promise<string> {
    await this.syncTabs();
    if (!this.tabs.some((tab) => tab.id === tabId))
      throw new Error(`任务标签页列表中找不到 ${tabId}`);
    this.currentTabId = tabId;
    await this.waitUntilTabLoaded(tabId);
    return `已切换到任务标签页 ${tabId}`;
  }

  async closeTab(tabId: number): Promise<string> {
    const target = this.tabs.find((tab) => tab.id === tabId);
    if (!target) throw new Error(`任务标签页列表中找不到 ${tabId}`);
    if (target.initial) throw new Error('不能关闭任务的起始标签页');
    await browser.tabs.remove(tabId);
    this.tabs = this.tabs.filter((tab) => tab.id !== tabId);
    if (this.currentTabId === tabId) this.currentTabId = this.initialTabId;
    return `已关闭标签页 ${tabId}`;
  }

  async getCurrentTabInfo(): Promise<{ title: string; url: string }> {
    if (this.currentTabId === null) return { title: '', url: '' };
    const tab = await browser.tabs.get(this.currentTabId);
    return { title: tab.title || '', url: tab.url || '' };
  }

  async summarizeTabs(): Promise<string> {
    await this.syncTabs();
    return [
      '| 标签页 ID | URL | 标题 | 当前页面 |',
      '| --- | --- | --- | --- |',
      ...this.tabs.map(
        (tab) =>
          `| ${tab.id} | ${tab.url || ''} | ${tab.title || '无标题'} | ${tab.id === this.currentTabId ? '是' : ''} |`
      ),
    ].join('\n');
  }

  async syncTabs(): Promise<void> {
    if (this.windowId === null) return;
    const live = await browser.tabs.query({ windowId: this.windowId });
    const liveById = new Map(
      live.flatMap((tab) => (tab.id === undefined ? [] : [[tab.id, tab] as const]))
    );
    this.tabs = this.tabs
      .filter((tab) => {
        const liveTab = liveById.get(tab.id);
        return Boolean(liveTab?.url && isInjectable(liveTab.url));
      })
      .map((tab) => ({ ...tab, ...liveById.get(tab.id) }));
    if (!this.tabs.some((tab) => tab.id === this.currentTabId)) {
      this.currentTabId = this.tabs.find((tab) => tab.initial)?.id ?? this.tabs[0]?.id ?? null;
    }
    const known = new Set(this.tabs.map((tab) => tab.id));
    for (const tab of live) {
      if (
        tab.id !== undefined &&
        !known.has(tab.id) &&
        tab.url &&
        isInjectable(tab.url) &&
        tab.openerTabId !== undefined &&
        known.has(tab.openerTabId)
      ) {
        this.tabs.push({
          id: tab.id,
          initial: false,
          url: tab.url,
          title: tab.title,
          status: tab.status,
        });
        this.currentTabId = tab.id;
      }
    }
  }

  async waitUntilTabLoaded(tabId: number, retryOnTimeout = false): Promise<void> {
    try {
      await this.waitUntilTabLoadedOnce(tabId);
    } catch (error) {
      if (!retryOnTimeout || !isTabLoadTimeout(error)) throw error;
      await browser.tabs.reload(tabId);
      await this.waitUntilTabLoadedOnce(tabId);
    }
  }

  private async waitUntilTabLoadedOnce(tabId: number): Promise<void> {
    const deadline = Date.now() + TAB_LOAD_TIMEOUT_MS;
    let lastStatus = 'unknown';
    let lastUrl = 'unknown';
    while (Date.now() < deadline) {
      const tab = await browser.tabs.get(tabId).catch(() => null);
      if (!tab) throw new Error(`标签页 ${tabId} 已关闭`);
      lastStatus = tab.status || 'unknown';
      lastUrl = tab.url || 'unknown';
      if (tab.status !== 'loading') return;
      await new Promise<void>((resolve) =>
        setTimeout(resolve, Math.min(TAB_LOAD_POLL_INTERVAL_MS, deadline - Date.now()))
      );
    }
    throw new Error(`标签页 ${tabId} 加载超时（${lastStatus}，${lastUrl}）`);
  }

  dispose(): void {
    this.tabs = [];
    this.currentTabId = null;
  }
}

function isTabLoadTimeout(error: unknown): boolean {
  return error instanceof Error && error.message.includes('加载超时');
}
