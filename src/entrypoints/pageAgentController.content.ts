import type { PageControlAction, PageControlMessage } from '@/lib/pageAgent/multiPageTypes';
import { PageController } from '@page-agent/page-controller';

type VerticalScrollOptions = { down: boolean; numPages: number; pixels?: number; index?: number };
type HorizontalScrollOptions = { right: boolean; pixels: number; index?: number };

declare global {
  interface Window {
    __DPP_PAGE_CONTROLLER_ACTIVE__?: boolean;
  }
}

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_end',
  main() {
    if (window.__DPP_PAGE_CONTROLLER_ACTIVE__) return;
    window.__DPP_PAGE_CONTROLLER_ACTIVE__ = true;

    let pageController: PageController | null = null;
    const getController = () => {
      pageController ??= new PageController({ enableMask: false, viewportExpansion: 400 });
      return pageController;
    };

    const listener = (
      rawMessage: unknown,
      _sender: Browser.runtime.MessageSender,
      sendResponse: (response: unknown) => void
    ): true | undefined => {
      if (!isPageControlMessage(rawMessage)) return;
      const controller = getController();
      const payload = rawMessage.payload || [];

      executePageAction(controller, rawMessage.action, payload)
        .then(sendResponse)
        .catch((error: unknown) =>
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          })
        );
      return true;
    };

    browser.runtime.onMessage.addListener(listener);
    void browser.runtime.sendMessage({ type: 'PAGE_AGENT_PAGE_CONTROLLER_READY' });
    return () => {
      browser.runtime.onMessage.removeListener(listener);
      pageController?.dispose();
      delete window.__DPP_PAGE_CONTROLLER_ACTIVE__;
    };
  },
});

function isPageControlMessage(message: unknown): message is PageControlMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === 'PAGE_AGENT_PAGE_CONTROL'
  );
}

function executePageAction(
  controller: PageController,
  action: PageControlAction,
  payload: unknown[]
): Promise<unknown> {
  switch (action) {
    case 'get_last_update_time':
      return controller.getLastUpdateTime();
    case 'get_browser_state':
      return controller.getBrowserState();
    case 'update_tree':
      return controller.updateTree();
    case 'clean_up_highlights':
      return controller.cleanUpHighlights();
    case 'click_element':
      return controller.clickElement(payload[0] as number);
    case 'input_text':
      return controller.inputText(payload[0] as number, payload[1] as string);
    case 'select_option':
      return controller.selectOption(payload[0] as number, payload[1] as string);
    case 'scroll':
      return controller.scroll(payload[0] as VerticalScrollOptions);
    case 'scroll_horizontally':
      return controller.scrollHorizontally(payload[0] as HorizontalScrollOptions);
  }
}
