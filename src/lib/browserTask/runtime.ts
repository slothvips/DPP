import { browser } from 'wxt/browser';
import { NanobrowserContext } from '@/lib/browserEngine/nanobrowserContext';
import type { BrowserEngineActResult } from '@/lib/browserEngine/nanobrowserContext';
import type { BrowserControlMessage, BrowserControlResponse, BrowserSnapshot } from './types';

const browserContext = new NanobrowserContext();

export class BrowserRuntime {
  constructor(private readonly tabId: number) {}

  async observe(): Promise<BrowserSnapshot> {
    return (await browserContext.getState(this.tabId)).page;
  }

  async act(
    action: BrowserControlMessage['action'],
    payload: Record<string, unknown> = {}
  ): Promise<BrowserEngineActResult> {
    if (action !== 'set_locked') return browserContext.act(this.tabId, action, payload);
    const response = await this.send(action, payload);
    return { message: response.message || '操作已完成' };
  }

  static async cleanup(): Promise<void> {
    await browserContext.cleanup();
  }

  async closeTab(fallbackTabId: number): Promise<void> {
    await browserContext.closeTab(this.tabId, fallbackTabId);
  }

  private async send(
    action: BrowserControlMessage['action'],
    payload: Record<string, unknown> = {}
  ): Promise<BrowserControlResponse> {
    const message: BrowserControlMessage = {
      type: 'BROWSER_CONTROL',
      action,
      targetTabId: this.tabId,
      payload,
    };
    const response = (await browser.runtime.sendMessage(message)) as BrowserControlResponse;
    if (response?.success === false) throw new Error(response.message || '网页操作失败');
    return response;
  }
}
