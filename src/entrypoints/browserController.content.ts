import type {
  BrowserControlMessage,
  BrowserElementRef,
  BrowserSnapshot,
} from '@/lib/browserTask/types';

declare global {
  interface Window {
    __DPP_BROWSER_CONTROLLER_ACTIVE__?: boolean;
  }
}

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_end',
  main() {
    document
      .querySelectorAll('[data-dpp-browser-task-overlay]')
      .forEach((element) => element.remove());
    if (window.__DPP_BROWSER_CONTROLLER_ACTIVE__) return;
    window.__DPP_BROWSER_CONTROLLER_ACTIVE__ = true;

    const listener = (
      rawMessage: unknown,
      _sender: Browser.runtime.MessageSender,
      sendResponse: (response: unknown) => void
    ): true | undefined => {
      if (!isControlMessage(rawMessage)) return;
      execute(rawMessage)
        .then(sendResponse)
        .catch((error: unknown) =>
          sendResponse({
            success: false,
            message: error instanceof Error ? error.message : String(error),
          })
        );
      return true;
    };

    browser.runtime.onMessage.addListener(listener);
    return () => {
      browser.runtime.onMessage.removeListener(listener);
      delete window.__DPP_BROWSER_CONTROLLER_ACTIVE__;
    };
  },
});

function isControlMessage(message: unknown): message is BrowserControlMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === 'BROWSER_CONTROL'
  );
}

async function execute(message: BrowserControlMessage) {
  const payload = message.payload || {};
  switch (message.action) {
    case 'observe':
      return { success: true, snapshot: observe(await waitForPageStable()) };
    case 'get_readiness': {
      const readiness = await waitForPageStable();
      return { success: true, readiness, snapshot: buildSnapshot(readiness) };
    }
    case 'click':
      click(requireElement(payload));
      await waitForPageStable();
      return { success: true, message: '已点击目标元素' };
    case 'fill':
      fill(requireElement(payload), readString(payload, 'text'));
      await waitForPageStable();
      return { success: true, message: '已填写目标字段' };
    case 'select':
      select(requireElement(payload), readString(payload, 'option'));
      await waitForPageStable();
      return { success: true, message: '已选择目标选项' };
    case 'scroll':
      window.scrollBy({
        top: readString(payload, 'direction') === 'up' ? -window.innerHeight : window.innerHeight,
        behavior: 'smooth',
      });
      await waitForPageStable();
      return { success: true, message: '已滚动页面' };
    case 'go_back':
      history.back();
      await waitForPageStable();
      return { success: true, message: '已返回上一页' };
    default:
      throw new Error(`页面不支持操作 ${message.action}`);
  }
}

function observe(readiness: BrowserSnapshot['readiness']): BrowserSnapshot {
  const elements: BrowserElementRef[] = [];
  const candidates = document.querySelectorAll<HTMLElement>(
    'a,button,input,textarea,select,[role="button"],[role="link"],[role="checkbox"],[contenteditable="true"]'
  );

  for (const [index, element] of Array.from(candidates).entries()) {
    if (!isVisible(element)) continue;
    const locator = createLocator(element);
    const text = cleanText(element.innerText || element.textContent || '');
    const label = cleanText(
      element.getAttribute('aria-label') ||
        element.getAttribute('placeholder') ||
        element.getAttribute('name') ||
        element.getAttribute('title') ||
        ''
    );
    const id = `e${index + 1}`;
    const fingerprint = `${element.tagName.toLowerCase()}|${label}|${text.slice(0, 80)}`;
    elements.push({
      id,
      tag: element.tagName.toLowerCase(),
      role: element.getAttribute('role') || '',
      text,
      label,
      locator,
      fingerprint,
      href: element instanceof HTMLAnchorElement ? element.href : undefined,
    });
    element.dataset.dppBrowserTaskId = id;
  }

  return buildSnapshot(readiness, elements);
}

function buildSnapshot(
  readiness: BrowserSnapshot['readiness'],
  elements: BrowserElementRef[] = []
): BrowserSnapshot {
  return {
    url: location.href,
    title: document.title,
    text: cleanText(document.body?.innerText || '').slice(0, 12000),
    elements,
    readiness,
  };
}

function requireElement(payload: Record<string, unknown>): HTMLElement {
  const locator = readString(payload, 'locator');
  const fingerprint = readString(payload, 'fingerprint');
  const element = document.querySelector<HTMLElement>(locator);
  if (!element || !isVisible(element)) throw new Error('目标元素已不存在或不可见，请重新观察页面');
  const actual = `${element.tagName.toLowerCase()}|${element.getAttribute('aria-label') || element.getAttribute('placeholder') || element.getAttribute('name') || element.getAttribute('title') || ''}|${cleanText(element.innerText || element.textContent || '').slice(0, 80)}`;
  if (actual !== fingerprint) throw new Error('页面已变化，目标元素指纹不匹配，请重新观察页面');
  return element;
}

function click(element: HTMLElement): void {
  element.scrollIntoView({ block: 'center', inline: 'nearest' });
  element.click();
}

function fill(element: HTMLElement, value: string): void {
  if (
    !(
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      element.isContentEditable
    )
  ) {
    throw new Error('目标元素不是可填写字段');
  }
  element.focus();
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value')?.set;
    setter?.call(element, value);
  } else {
    element.textContent = value;
  }
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

function select(element: HTMLElement, value: string): void {
  if (!(element instanceof HTMLSelectElement)) throw new Error('目标元素不是下拉框');
  const option = Array.from(element.options).find(
    (item) => item.text.trim() === value || item.value === value
  );
  if (!option) throw new Error(`下拉框中不存在选项：${value}`);
  element.value = option.value;
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

function createLocator(element: HTMLElement): string {
  const testId =
    element.getAttribute('data-testid') ||
    element.getAttribute('data-qa') ||
    element.getAttribute('data-cy');
  if (testId)
    return `[data-testid="${CSS.escape(testId)}"],[data-qa="${CSS.escape(testId)}"],[data-cy="${CSS.escape(testId)}"]`;
  if (element.id) return `#${CSS.escape(element.id)}`;
  const name = element.getAttribute('name');
  if (name) return `${element.tagName.toLowerCase()}[name="${CSS.escape(name)}"]`;
  const path: string[] = [];
  let current: HTMLElement | null = element;
  while (current && current !== document.body && path.length < 6) {
    const tag = current.tagName.toLowerCase();
    const siblings = current.parentElement
      ? Array.from(current.parentElement.children).filter(
          (child) => child.tagName === current?.tagName
        )
      : [];
    const index = siblings.indexOf(current) + 1;
    path.unshift(`${tag}:nth-of-type(${index})`);
    current = current.parentElement;
  }
  return path.join(' > ');
}

function isVisible(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  return (
    rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
  );
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
function readString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== 'string' || !value) throw new Error(`${key} 必须是非空字符串`);
  return value;
}
async function waitForPageStable(): Promise<BrowserSnapshot['readiness']> {
  const startedAt = Date.now();
  const deadline = startedAt + 4000;
  const stableWindowMs = 400;
  let previousSignature = '';
  let stableSince = 0;

  while (Date.now() < deadline) {
    const signature = pageSignature();
    const ready = document.readyState === 'complete';
    if (ready && signature === previousSignature) {
      if (!stableSince) stableSince = Date.now();
      if (Date.now() - stableSince >= stableWindowMs) {
        return {
          documentReadyState: document.readyState,
          stable: true,
          stableForMs: Date.now() - stableSince,
          observedAt: Date.now(),
        };
      }
    } else {
      previousSignature = signature;
      stableSince = ready ? Date.now() : 0;
    }
    await sleep(150);
  }

  return {
    documentReadyState: document.readyState,
    stable: false,
    stableForMs: stableSince ? Date.now() - stableSince : 0,
    observedAt: Date.now(),
  };
}

function pageSignature(): string {
  const text = cleanText(document.body?.innerText || '');
  const interactiveCount = document.querySelectorAll(
    'a,button,input,textarea,select,[role="button"],[role="link"],[role="checkbox"],[contenteditable="true"]'
  ).length;
  return `${location.href}|${document.title}|${text.length}|${text.slice(0, 6000)}|${interactiveCount}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
