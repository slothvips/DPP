import { logger } from '@/utils/logger';
import { record } from '@/vendor/rrweb/rrweb.js';
import { pack } from '@rrweb/packer';
import type { eventWithTime } from '@rrweb/types';
import { createRecorderInterceptors } from './interceptors';
import { createRecorderFloatingUI } from './ui';

type RecorderStatusResponse = {
  success?: boolean;
  data?: {
    isRecording?: boolean;
    startTime?: number;
  };
};

type RuntimeMessage = {
  type: string;
};

export function createRecorderContentController() {
  let stopFn: (() => void) | undefined | null = null;
  let events: eventWithTime[] = [];
  let startTime = 0;

  const floatingUI = createRecorderFloatingUI(() => {
    stopRecording();
  });
  const interceptors = createRecorderInterceptors((event) => {
    events.push(event);
  });

  function init() {
    void browser.runtime
      .sendMessage({ type: 'RECORDER_GET_STATUS_FOR_CONTENT' })
      .then((response: RecorderStatusResponse | undefined) => {
        const state = response?.data;
        if (!response?.success || !state?.isRecording) {
          return;
        }

        startTime = state.startTime || Date.now();
        events = [];
        startRecording(true);
      });

    browser.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
      if (message.type === 'RECORDER_INJECT') {
        startRecording();
      }
      if (message.type === 'RECORDER_STOP_CAPTURE') {
        stopRecording();
      }
      if (message.type === 'RECORDER_PING') {
        sendResponse({ success: true });
        return true;
      }
      return undefined;
    });
  }

  function startRecording(isResume = false) {
    if (stopFn) return;

    events = [];
    if (!isResume) {
      startTime = Date.now();
    }

    logger.debug('Starting rrweb recording');

    floatingUI.mount(startTime);
    interceptors.injectAll();

    stopFn = record({
      packFn: pack,
      emit(event) {
        events.push(event);
      },
      checkoutEveryNms: 5000,
      blockClass: 'rr-block',
      blockSelector: 'video, audio, [data-player], .bilibili-player-video',
      ignoreClass: 'rr-ignore',
      maskTextClass: 'rr-mask',
      maskAllInputs: true,
    });
  }

  function stopRecording() {
    if (!stopFn) return;

    stopFn();
    stopFn = null;
    floatingUI.unmount();
    interceptors.removeAll();

    const duration = Date.now() - startTime;
    logger.debug('Stopped rrweb recording', { duration, events: events.length });

    const faviconEl = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
    const favicon = faviconEl?.href;

    void browser.runtime.sendMessage({
      type: 'RECORDER_COMPLETE',
      events,
      url: window.location.href,
      favicon,
      duration,
    });

    events = [];
  }

  return { init };
}
