import { browser } from 'wxt/browser';
import type { BrowserState } from '@page-agent/page-controller';
import type { PageControlAction, PageControlMessage } from './multiPageTypes';
import type { TabsController } from './tabsController';

export class RemotePageController {
  private lastState: BrowserState | null = null;

  constructor(
    private readonly tabs: TabsController,
    private readonly onSensitiveInput?: (reason: string) => Promise<void>
  ) {}
  async getLastUpdateTime(): Promise<number> {
    return this.send<number>('get_last_update_time');
  }
  async getBrowserState(): Promise<BrowserState> {
    const state = await this.send<BrowserState>('get_browser_state');
    state.header = `${await this.tabs.summarizeTabs()}\n\n${state.header || ''}`;
    this.lastState = state;
    return state;
  }
  async updateTree(): Promise<void> {
    await this.send('update_tree');
  }
  async cleanUpHighlights(): Promise<void> {
    await this.send('clean_up_highlights');
  }
  async clickElement(index: number): Promise<unknown> {
    return this.send('click_element', [index]);
  }
  async inputText(index: number, text: string): Promise<unknown> {
    const target = this.describeElement(index);
    if (/password|passwd|密码|验证码|verification code|token|secret/i.test(target)) {
      if (!this.onSensitiveInput) throw new Error('当前任务不支持用户接管');
      await this.onSensitiveInput(
        '检测到密码、验证码或 Token 等敏感输入。请在目标页面手动填写该字段，完成后返回此处继续任务。'
      );
      return '用户已完成敏感字段输入，继续当前步骤';
    }
    return this.send('input_text', [index, text]);
  }
  async selectOption(index: number, option: string): Promise<unknown> {
    return this.send('select_option', [index, option]);
  }
  async scroll(options: unknown): Promise<unknown> {
    return this.send('scroll', [options]);
  }
  async scrollHorizontally(options: unknown): Promise<unknown> {
    return this.send('scroll_horizontally', [options]);
  }
  async showMask(): Promise<void> {}
  async hideMask(): Promise<void> {}
  dispose(): void {}
  private async send<T>(action: PageControlAction, payload?: unknown[]): Promise<T> {
    const targetTabId = this.tabs.currentTabId;
    if (targetTabId === null) throw new Error('当前没有可操作的标签页');
    const message: PageControlMessage = {
      type: 'PAGE_AGENT_PAGE_CONTROL',
      action,
      targetTabId,
      payload,
    };
    const response = (await this.sendToTab(message)) as T & {
      success?: boolean;
      error?: string;
      data?: T;
    };
    if (response?.success === false) throw new Error(response.error || '网页操作失败');
    if (response === undefined || response === null) {
      throw new Error('页面控制器未返回浏览器状态');
    }
    return response.data === undefined ? response : response.data;
  }

  private async sendToTab(message: PageControlMessage): Promise<unknown> {
    try {
      return await browser.tabs.sendMessage(message.targetTabId, message);
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !/Receiving end does not exist|Could not establish connection/i.test(error.message)
      ) {
        throw error;
      }
      await browser.scripting.executeScript({
        target: { tabId: message.targetTabId },
        files: ['/content-scripts/pageAgentController.js'],
      });
      return await browser.tabs.sendMessage(message.targetTabId, message);
    }
  }

  private describeElement(index: number): string {
    // ponytail: PageController exposes only dehydrated text here; replace this heuristic if it adds structured element metadata.
    return (
      this.lastState?.content
        .split('\n')
        .find((line) => line.includes(`[${index}]`))
        ?.trim()
        .slice(0, 300) || ''
    );
  }
}
