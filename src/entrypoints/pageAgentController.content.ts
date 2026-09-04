import type { PageControlAction, PageControlMessage } from '@/lib/pageAgent/multiPageTypes';
import { PageController } from '@page-agent/page-controller';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_end',
  main() {
    let controller: PageController | null = null;
    const listener = (
      raw: unknown,
      sender: Browser.runtime.MessageSender,
      sendResponse: (response: unknown) => void
    ): true | undefined => {
      if (sender.id !== browser.runtime.id || !isMessage(raw)) return;
      controller ??= new PageController({
        enableMask: true,
        highlightOpacity: 0.1,
        highlightLabelOpacity: 0.5,
        viewportExpansion: 400,
      });
      execute(controller, raw.action, raw.payload || [])
        .then((result) => sendResponse({ success: true, data: result }))
        .catch((error: unknown) =>
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          })
        );
      return true;
    };
    browser.runtime.onMessage.addListener(listener);
    return () => {
      browser.runtime.onMessage.removeListener(listener);
      controller?.dispose();
    };
  },
});

function isMessage(value: unknown): value is PageControlMessage {
  if (typeof value !== 'object' || value === null) return false;
  const message = value as Record<string, unknown>;
  return (
    message.type === 'PAGE_AGENT_PAGE_CONTROL' &&
    typeof message.targetTabId === 'number' &&
    isPageControlAction(message.action) &&
    (message.payload === undefined || Array.isArray(message.payload))
  );
}

function isPageControlAction(value: unknown): value is PageControlAction {
  return (
    value === 'get_last_update_time' ||
    value === 'get_browser_state' ||
    value === 'read_page' ||
    value === 'update_tree' ||
    value === 'clean_up_highlights' ||
    value === 'click_element' ||
    value === 'input_text' ||
    value === 'select_option' ||
    value === 'scroll' ||
    value === 'scroll_horizontally'
  );
}

function execute(
  controller: PageController,
  action: PageControlAction,
  payload: unknown[]
): Promise<unknown> {
  switch (action) {
    case 'get_last_update_time':
      return controller.getLastUpdateTime();
    case 'get_browser_state':
      return controller.getBrowserState();
    case 'read_page':
      return Promise.resolve(readPage(payload));
    case 'update_tree':
      return controller.updateTree();
    case 'clean_up_highlights':
      return controller.cleanUpHighlights();
    case 'click_element':
      return controller.clickElement(readElementIndex(payload));
    case 'input_text':
      return controller.inputText(readElementIndex(payload), readText(payload, 1));
    case 'select_option':
      return controller.selectOption(readElementIndex(payload), readText(payload, 1));
    case 'scroll':
      return controller.scroll(readScrollOptions<Parameters<PageController['scroll']>[0]>(payload));
    case 'scroll_horizontally':
      return controller.scrollHorizontally(
        readScrollOptions<Parameters<PageController['scrollHorizontally']>[0]>(payload)
      );
  }
}

function readPage(payload: unknown[]) {
  const requestedLimit = payload[0];
  const maxChars =
    typeof requestedLimit === 'number' && Number.isInteger(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1_000), 20_000)
      : 10_000;
  const content = document.body?.innerText?.replace(/\s+\n/g, '\n').trim() || '';
  const selectedText = window.getSelection()?.toString().trim() || '';
  return {
    title: document.title,
    url: location.href,
    selectedText: selectedText.slice(0, maxChars),
    content: content.slice(0, maxChars),
    truncated: content.length > maxChars,
  };
}

function readElementIndex(payload: unknown[]): number {
  if (!Number.isInteger(payload[0]) || (payload[0] as number) < 0) {
    throw new Error('页面元素索引无效');
  }
  return payload[0] as number;
}

function readText(payload: unknown[], index: number): string {
  const value = payload[index];
  if (typeof value !== 'string' || value.length > 100_000) {
    throw new Error('页面输入内容无效或过长');
  }
  return value;
}

function readScrollOptions<T>(payload: unknown[]): T {
  if (typeof payload[0] !== 'object' || payload[0] === null || Array.isArray(payload[0])) {
    throw new Error('页面滚动参数无效');
  }
  return payload[0] as T;
}
