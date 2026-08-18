import { browser } from 'wxt/browser';
import { PAGE_AGENT_TASK_GROUP_STORAGE_KEY } from './multiPageTypes';
import type { TabControlAction, TabControlMessage } from './multiPageTypes';
import { isInjectable } from './utils';

interface BrowserTab {
  id?: number;
  windowId?: number;
  openerTabId?: number;
  groupId?: number;
  url?: string;
  title?: string;
  status?: 'loading' | 'complete' | 'unloaded';
}

interface TrackedTab {
  id: number;
  initial: boolean;
  url?: string;
  title?: string;
  status?: BrowserTab['status'];
  groupId?: number;
}

async function sendTabControl<T>(action: TabControlAction, payload: Record<string, unknown>) {
  const message: TabControlMessage = { type: 'PAGE_AGENT_TAB_CONTROL', action, payload };
  const response = (await browser.runtime.sendMessage(message)) as unknown as T & {
    error?: string;
  };
  if (response?.error) throw new Error(response.error);
  return response;
}

export class TabsController {
  currentTabId: number | null = null;

  private readonly initialTabId: number;
  private windowId: number | null = null;
  private groupId: number | null = null;
  private task = '';
  private groupName = '';
  private tabs: TrackedTab[] = [];
  private disposed = false;

  constructor(initialTabId: number) {
    this.initialTabId = initialTabId;
  }

  async init(task: string, groupName?: string): Promise<void> {
    if (this.disposed) throw new Error('标签页控制器已销毁');

    const tab = await sendTabControl<BrowserTab>('get_tab_info', { tabId: this.initialTabId });
    if (!tab.url || !isInjectable(tab.url)) {
      throw new Error('当前起始标签页无法运行网页助手');
    }

    if (tab.windowId === undefined) throw new Error('选中的标签页缺少窗口 ID');
    this.windowId = tab.windowId;
    this.task = task;
    this.groupName = groupName?.trim() || '';
    this.currentTabId = this.initialTabId;
    this.tabs = [this.toTrackedTab(tab, true)];

    const stored = await browser.storage.session.get(PAGE_AGENT_TASK_GROUP_STORAGE_KEY);
    const storedGroupId = stored[PAGE_AGENT_TASK_GROUP_STORAGE_KEY];
    let reusedGroup = false;
    if (typeof storedGroupId === 'number') {
      try {
        const group = await sendTabControl<{ success: boolean; groupId?: number }>('group_tabs', {
          tabIds: [this.initialTabId],
          groupId: storedGroupId,
        });
        this.groupId = group.groupId ?? null;
        reusedGroup = this.groupId !== null;
      } catch {
        await browser.storage.session.remove(PAGE_AGENT_TASK_GROUP_STORAGE_KEY);
      }
    }

    if (!reusedGroup) {
      const group = await sendTabControl<{ success: boolean; groupId?: number }>('group_tabs', {
        tabIds: [this.initialTabId],
        groupId: -1,
      });
      this.groupId = group.groupId ?? null;
    }

    if (this.groupId !== null) {
      await browser.storage.session.set({ [PAGE_AGENT_TASK_GROUP_STORAGE_KEY]: this.groupId });
    }
    if (this.groupId !== null) {
      await sendTabControl<{ success: boolean }>('update_tab_group', {
        groupId: this.groupId,
        title: this.getGroupTitle(),
        color: 'blue',
      });
    }
  }

  async openNewTab(url: string): Promise<string> {
    if (this.windowId === null) throw new Error('标签页控制器尚未初始化');

    const result = await sendTabControl<{ success: boolean; tabId?: number }>('open_new_tab', {
      url,
      windowId: this.windowId,
      openerTabId: this.currentTabId,
    });
    if (!result.success || result.tabId === undefined) throw new Error('无法打开新的任务标签页');

    this.tabs.push({ id: result.tabId, initial: false, url, status: 'loading' });
    if (this.groupId !== null) {
      await sendTabControl<{ success: boolean }>('group_tabs', {
        tabIds: [result.tabId],
        groupId: this.groupId,
      });
    }
    this.currentTabId = result.tabId;
    await this.waitUntilTabLoaded(result.tabId);
    return `已打开任务标签页 ${result.tabId}，并切换到该页面：${url}`;
  }

  async switchToTab(tabId: number): Promise<string> {
    await this.syncTabs();
    if (!this.tabs.some((tab) => tab.id === tabId)) {
      throw new Error(`任务标签页列表中找不到 ${tabId}`);
    }
    this.currentTabId = tabId;
    await this.waitUntilTabLoaded(tabId);
    return `已切换到任务标签页 ${tabId}`;
  }

  async closeTab(tabId: number): Promise<string> {
    const target = this.tabs.find((tab) => tab.id === tabId);
    if (!target) throw new Error(`任务标签页列表中找不到 ${tabId}`);
    if (target.initial) throw new Error('不能关闭任务的起始标签页');

    const result = await sendTabControl<{ success: boolean }>('close_tab', { tabId });
    if (!result.success) throw new Error(`无法关闭任务标签页 ${tabId}`);

    this.tabs = this.tabs.filter((tab) => tab.id !== tabId);
    if (this.currentTabId === tabId) {
      this.currentTabId = this.tabs.find((tab) => tab.initial)?.id ?? null;
    }
    return `已关闭任务标签页 ${tabId}`;
  }

  async getCurrentTabInfo(): Promise<{ title: string; url: string }> {
    if (this.currentTabId === null) return { title: '', url: '' };
    const tab = await sendTabControl<BrowserTab>('get_tab_info', { tabId: this.currentTabId });
    return { title: tab.title || '', url: tab.url || '' };
  }

  async summarizeTabs(): Promise<string> {
    await this.syncTabs();
    const rows = [
      '| 标签页 ID | URL | 标题 | 当前页面 |',
      '| --- | --- | --- | --- |',
      ...this.tabs.map(
        (tab) =>
          `| ${tab.id} | ${tab.url || ''} | ${tab.title || '无标题'} | ${tab.id === this.currentTabId ? '是' : ''} |`
      ),
    ];
    return rows.join('\n');
  }

  async syncTabs(): Promise<void> {
    if (this.disposed || this.windowId === null) return;

    const result = await sendTabControl<{ success: boolean; tabs: BrowserTab[] }>(
      'get_window_tabs',
      {
        windowId: this.windowId,
      }
    );
    if (!result.success) return;

    const liveById = new Map(
      result.tabs.flatMap((tab) => (tab.id === undefined ? [] : ([[tab.id, tab]] as const)))
    );
    this.tabs = this.tabs
      .filter((tab) => liveById.has(tab.id))
      .map((tab) => this.toTrackedTab(liveById.get(tab.id)!, tab.initial));

    const trackedIds = new Set(this.tabs.map((tab) => tab.id));
    const childTabs = result.tabs.filter(
      (tab) =>
        tab.id !== undefined &&
        !trackedIds.has(tab.id) &&
        !!tab.url &&
        isInjectable(tab.url) &&
        ((tab.openerTabId !== undefined && trackedIds.has(tab.openerTabId)) ||
          (this.groupId !== null && tab.groupId === this.groupId))
    );
    for (const tab of childTabs) {
      this.tabs.push(this.toTrackedTab(tab, false));
      if (tab.openerTabId !== undefined && tab.id !== undefined) {
        this.currentTabId = tab.id;
      }
    }

    if (this.currentTabId !== null && !this.tabs.some((tab) => tab.id === this.currentTabId)) {
      this.currentTabId = this.tabs.at(-1)?.id ?? null;
    }
  }

  async waitUntilTabLoaded(tabId: number, signal?: AbortSignal): Promise<void> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < 10_000) {
      if (signal?.aborted) throw new DOMException('等待标签页加载已取消', 'AbortError');
      await this.syncTabs();
      const tab = this.tabs.find((item) => item.id === tabId);
      if (!tab) throw new Error(`标签页 ${tabId} 已关闭`);
      if (tab.status !== 'loading') return;
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    throw new Error(`标签页 ${tabId} 加载超时`);
  }

  dispose(): void {
    this.disposed = true;
    this.tabs = [];
    this.currentTabId = null;
  }

  private toTrackedTab(tab: BrowserTab, initial: boolean): TrackedTab {
    if (tab.id === undefined) throw new Error('标签页缺少 ID');
    return {
      id: tab.id,
      initial,
      url: tab.url,
      title: tab.title,
      status: tab.status,
      groupId: tab.groupId,
    };
  }

  private getGroupTitle(): string {
    const normalizedName = (this.groupName || this.task).replace(/\s+/g, ' ').trim();
    const suffix =
      normalizedName.length > 32 ? `${normalizedName.slice(0, 32)}...` : normalizedName;
    return suffix ? `DPP · ${suffix}` : 'DPP · 网页任务';
  }
}
