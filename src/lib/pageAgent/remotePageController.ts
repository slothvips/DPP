import { browser } from 'wxt/browser';
import type { BrowserState } from '@page-agent/page-controller';
import type {
  PageActionResult,
  PageControlAction,
  PageControlMessage,
  PageControlResponse,
} from './multiPageTypes';
import type { TabsController } from './tabsController';

type VerticalScrollOptions = { down: boolean; numPages: number; pixels?: number; index?: number };
type HorizontalScrollOptions = { right: boolean; pixels: number; index?: number };

export class RemotePageController {
  constructor(private readonly tabsController: TabsController) {}

  async getLastUpdateTime(): Promise<number> {
    return this.send<number>('get_last_update_time');
  }

  async getBrowserState(): Promise<BrowserState> {
    const tabInfo = await this.tabsController.getCurrentTabInfo();
    let state: BrowserState;
    if (!tabInfo.url) {
      state = {
        url: '',
        title: tabInfo.title,
        header: '',
        content: '当前没有可读取的页面。请打开或切换到普通网页。',
        footer: '',
      };
    } else {
      state = await this.send<BrowserState>('get_browser_state');
    }
    state.header = `${await this.tabsController.summarizeTabs()}\n\n${state.header || ''}`;
    return state;
  }

  async updateTree(): Promise<void> {
    await this.send<void>('update_tree');
  }

  async cleanUpHighlights(): Promise<void> {
    await this.send<void>('clean_up_highlights');
  }

  async clickElement(index: number): Promise<PageActionResult> {
    const result = await this.send<PageActionResult>('click_element', [index]);
    await new Promise((resolve) => setTimeout(resolve, 700));
    return result;
  }

  async inputText(index: number, text: string): Promise<PageActionResult> {
    return this.send<PageActionResult>('input_text', [index, text]);
  }

  async selectOption(index: number, optionText: string): Promise<PageActionResult> {
    return this.send<PageActionResult>('select_option', [index, optionText]);
  }

  async scroll(options: VerticalScrollOptions): Promise<PageActionResult> {
    return this.send<PageActionResult>('scroll', [options]);
  }

  async scrollHorizontally(options: HorizontalScrollOptions): Promise<PageActionResult> {
    return this.send<PageActionResult>('scroll_horizontally', [options]);
  }

  async showMask(): Promise<void> {}

  async hideMask(): Promise<void> {}

  dispose(): void {}

  private async send<T extends PageControlResponse>(
    action: PageControlAction,
    payload?: unknown[]
  ): Promise<T> {
    const targetTabId = this.tabsController.currentTabId;
    if (targetTabId === null) throw new Error('当前没有可操作的标签页');

    const message: PageControlMessage = {
      type: 'PAGE_AGENT_PAGE_CONTROL',
      action,
      targetTabId,
      payload,
    };
    const response = (await browser.runtime.sendMessage(message)) as T & {
      success?: boolean;
      error?: string;
    };
    if (response?.success === false && response.error) throw new Error(response.error);
    return response;
  }
}
