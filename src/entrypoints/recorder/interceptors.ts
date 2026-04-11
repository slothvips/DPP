import {
  CONSOLE_PLUGIN_NAME,
  type ConsolePluginEvent,
  NETWORK_PLUGIN_NAME,
  type NetworkPluginEvent,
} from '@/lib/rrweb-plugins';
import { logger } from '@/utils/logger';
import type { eventWithTime } from '@rrweb/types';

const NETWORK_EVENT_NAME = 'dpp-network-request';
const CONSOLE_EVENT_NAME = 'dpp-console-log';
const NETWORK_RESTORE_EVENT = 'dpp-network-restore';
const CONSOLE_RESTORE_EVENT = 'dpp-console-restore';

function createPluginEvent(
  plugin: string,
  payload: ConsolePluginEvent | NetworkPluginEvent
): eventWithTime {
  return {
    type: 6,
    data: {
      plugin,
      payload,
    },
    timestamp: Date.now(),
  };
}

function createPageInterceptor(options: {
  eventName: string;
  loggerLabel: string;
  pluginName: string;
  restoreEventName: string;
  scriptPath: '/network-interceptor.js' | '/console-interceptor.js';
  toPayload: (data: unknown) => ConsolePluginEvent | NetworkPluginEvent;
  onEvent: (event: eventWithTime) => void;
}) {
  let eventHandler: ((event: Event) => void) | null = null;
  let injectedScript: HTMLScriptElement | null = null;

  function inject() {
    eventHandler = (event: Event) => {
      const customEvent = event as CustomEvent;
      const payload = options.toPayload(customEvent.detail);
      options.onEvent(createPluginEvent(options.pluginName, payload));
    };

    window.addEventListener(options.eventName, eventHandler);

    injectedScript = document.createElement('script');
    injectedScript.src = browser.runtime.getURL(options.scriptPath as '/sidepanel.html');
    injectedScript.onload = () => {
      logger.debug(`${options.loggerLabel} injected`);
    };
    injectedScript.onerror = (error) => {
      logger.error(`Failed to inject ${options.loggerLabel.toLowerCase()}`, error);
    };
    (document.head || document.documentElement).appendChild(injectedScript);
  }

  function remove() {
    try {
      window.dispatchEvent(new CustomEvent(options.restoreEventName));
    } catch {
      // ignore
    }

    if (eventHandler) {
      window.removeEventListener(options.eventName, eventHandler);
      eventHandler = null;
    }

    if (injectedScript) {
      injectedScript.remove();
      injectedScript = null;
    }
  }

  return { inject, remove };
}

export function createRecorderInterceptors(onEvent: (event: eventWithTime) => void) {
  const networkInterceptor = createPageInterceptor({
    eventName: NETWORK_EVENT_NAME,
    loggerLabel: 'Network interceptor',
    pluginName: NETWORK_PLUGIN_NAME,
    restoreEventName: NETWORK_RESTORE_EVENT,
    scriptPath: '/network-interceptor.js',
    toPayload: (data) =>
      ({
        type: 'network',
        data,
        timestamp: Date.now(),
      }) as NetworkPluginEvent,
    onEvent,
  });

  const consoleInterceptor = createPageInterceptor({
    eventName: CONSOLE_EVENT_NAME,
    loggerLabel: 'Console interceptor',
    pluginName: CONSOLE_PLUGIN_NAME,
    restoreEventName: CONSOLE_RESTORE_EVENT,
    scriptPath: '/console-interceptor.js',
    toPayload: (data) =>
      ({
        type: 'console',
        data,
        timestamp: Date.now(),
      }) as ConsolePluginEvent,
    onEvent,
  });

  return {
    injectAll() {
      networkInterceptor.inject();
      consoleInterceptor.inject();
    },
    removeAll() {
      networkInterceptor.remove();
      consoleInterceptor.remove();
    },
  };
}
