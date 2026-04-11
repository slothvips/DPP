import { logger } from '@/utils/logger';

export const RRWEB_JSON_SUFFIX = '.rrweb.json';
export const IFRAME_RETRY_DELAYS = [500, 1000, 2000, 3000, 5000, 8000];
export const MAIN_FRAME_RETRY_DELAYS = [500, 1000, 2000, 3000, 5000];
export const IFRAME_CHECK_DELAYS = [500, 1500, 3000, 5000];

export function logZentao(...args: unknown[]) {
  logger.debug('[DPP Zentao]', ...args);
}

export function applyStyles(element: HTMLElement, styles: Partial<CSSStyleDeclaration>) {
  Object.assign(element.style, styles);
}

export function scheduleRetries(callback: () => void, delays: number[]) {
  for (const delay of delays) {
    setTimeout(callback, delay);
  }
}

export function observeBodyMutations(
  body: HTMLElement,
  callback: () => void,
  debounceMs: number = 100
) {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const observer = new MutationObserver(() => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(callback, debounceMs);
  });

  observer.observe(body, { childList: true, subtree: true });
  return observer;
}
