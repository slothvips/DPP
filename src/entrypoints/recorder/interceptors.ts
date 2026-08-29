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

function readAuthenticatedPayload(detail: unknown, channelToken: string): unknown | null {
  if (!detail || typeof detail !== 'object') return null;
  const envelope = detail as { channelToken?: unknown; payload?: unknown };
  return envelope.channelToken === channelToken && 'payload' in envelope ? envelope.payload : null;
}

function isNetworkPayload(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Record<string, unknown>;
  return (
    typeof payload.id === 'string' &&
    (payload.type === 'fetch' || payload.type === 'xhr' || payload.type === 'sse') &&
    typeof payload.method === 'string' &&
    typeof payload.url === 'string' &&
    typeof payload.startTime === 'number'
  );
}

function isConsolePayload(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Record<string, unknown>;
  return (
    typeof payload.id === 'string' &&
    ['log', 'info', 'warn', 'error', 'debug', 'trace'].includes(String(payload.level)) &&
    Array.isArray(payload.args) &&
    typeof payload.timestamp === 'number'
  );
}

function createPageInterceptor(options: {
  eventName: string;
  loggerLabel: string;
  pluginName: string;
  restoreEventName: string;
  scriptPath: '/network-interceptor.js' | '/console-interceptor.js';
  toPayload: (data: unknown) => ConsolePluginEvent | NetworkPluginEvent;
  validatePayload: (data: unknown) => boolean;
  onEvent: (event: eventWithTime) => void;
}) {
  let eventHandler: ((event: Event) => void) | null = null;
  let injectedScript: HTMLScriptElement | null = null;
  let channelToken = '';

  function inject() {
    channelToken = crypto.randomUUID();
    eventHandler = (event: Event) => {
      const customEvent = event as CustomEvent<unknown>;
      const data = readAuthenticatedPayload(customEvent.detail, channelToken);
      if (data === null || !options.validatePayload(data)) return;
      const payload = options.toPayload(data);
      options.onEvent(createPluginEvent(options.pluginName, payload));
    };

    window.addEventListener(options.eventName, eventHandler);

    injectedScript = document.createElement('script');
    injectedScript.src = browser.runtime.getURL(options.scriptPath as '/sidepanel.html');
    injectedScript.dataset.dppChannelToken = channelToken;
    injectedScript.onload = () => {
      logger.debug(`${options.loggerLabel} injected`);
      injectedScript?.remove();
      injectedScript = null;
    };
    injectedScript.onerror = (error) => {
      logger.error(`Failed to inject ${options.loggerLabel.toLowerCase()}`, error);
    };
    (document.head || document.documentElement).appendChild(injectedScript);
  }

  function remove() {
    try {
      window.dispatchEvent(new CustomEvent(options.restoreEventName, { detail: { channelToken } }));
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
    channelToken = '';
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
    validatePayload: isNetworkPayload,
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
    validatePayload: isConsolePayload,
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
