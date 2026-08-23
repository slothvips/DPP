const ACTIVE_FLAG = '__DPP_INTERACTIVE_ELEMENTS_ACTIVE__';
const INTERACTIVE_MARKER = 'data-dpp-interactive';
const INTERACTION_EVENTS = new Set([
  'click',
  'dblclick',
  'mousedown',
  'mouseup',
  'pointerdown',
  'pointerup',
  'touchstart',
  'touchend',
]);

declare global {
  interface Window {
    [ACTIVE_FLAG]?: boolean;
  }
}

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  world: 'MAIN',
  main() {
    if (window[ACTIVE_FLAG]) return;
    window[ACTIVE_FLAG] = true;

    const addEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function addTrackedEventListener(
      this: EventTarget,
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions
    ): void {
      if (listener !== null && INTERACTION_EVENTS.has(type) && this instanceof Element) {
        this.setAttribute(INTERACTIVE_MARKER, 'true');
      }
      addEventListener.call(this, type, listener, options);
    };
  },
});
