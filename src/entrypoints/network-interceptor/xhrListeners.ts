import type { NetworkRequestData } from './types';
import { emitNetworkEvent, parseXHRHeaders, processHeaders, serializeBody } from './utils';
import {
  type ExtendedXHR,
  type XhrNetworkData,
  createXhrStartEvent,
  createXhrTerminalEvent,
  resolveXhrResponseBody,
} from './xhrShared';

interface CreateXhrListenersOptions {
  xhr: ExtendedXHR;
  data: XhrNetworkData;
}

export function assignXhrRequestBody(
  xhr: ExtendedXHR,
  body?: Document | XMLHttpRequestBodyInit | null
) {
  const data = xhr._dppNetworkData;
  if (!data) {
    return;
  }

  try {
    data.requestBody = serializeBody(body);
  } catch {
    // ignore
  }
}

export function emitXhrStartEvent(data: XhrNetworkData) {
  emitNetworkEvent(createXhrStartEvent(data, processHeaders(data.requestHeaders)));
}

export function createXhrListeners({ xhr, data }: CreateXhrListenersOptions) {
  function beginTerminal(): boolean {
    if (xhr._dppNetworkTerminal || !xhr._dppNetworkData) return false;
    xhr._dppNetworkTerminal = true;
    return true;
  }

  function cleanup(): void {
    xhr.removeEventListener('readystatechange', handleReadyStateChange);
    xhr.removeEventListener('loadend', handleLoadEnd);
    xhr.removeEventListener('error', handleError);
    xhr.removeEventListener('timeout', handleTimeout);
    xhr._dppNetworkData = undefined;
    xhr._dppRemoveNetworkListeners = undefined;
  }

  const handleReadyStateChange = () => {
    try {
      if (!xhr._dppNetworkData || xhr._dppNetworkTerminal || xhr.readyState !== 2) {
        return;
      }

      const contentType = xhr.getResponseHeader('content-type') || '';
      emitNetworkEvent({
        id: data.id,
        type: 'xhr',
        method: data.method,
        url: data.url,
        status: xhr.status,
        statusText: xhr.statusText,
        startTime: data.startTime,
        requestHeaders: processHeaders(data.requestHeaders),
        responseHeaders: processHeaders(parseXHRHeaders(xhr.getAllResponseHeaders())),
        requestBody: data.requestBody,
        responseType: contentType,
        phase: 'response-headers',
      });
    } catch {
      // ignore
    }
  };

  const handleLoadEnd = () => {
    try {
      if (!beginTerminal()) {
        return;
      }

      const contentType = xhr.getResponseHeader('content-type') || '';
      const endTime = Date.now();
      const networkData: NetworkRequestData = {
        id: data.id,
        type: 'xhr',
        method: data.method,
        url: data.url,
        status: xhr.status,
        statusText: xhr.statusText,
        startTime: data.startTime,
        endTime,
        duration: endTime - data.startTime,
        requestHeaders: processHeaders(data.requestHeaders),
        responseHeaders: processHeaders(parseXHRHeaders(xhr.getAllResponseHeaders())),
        requestBody: data.requestBody,
        responseType: contentType,
        phase: 'complete',
        responseBody: resolveXhrResponseBody(xhr, contentType),
      };

      emitNetworkEvent(networkData);
    } catch {
      // ignore
    } finally {
      cleanup();
    }
  };

  const handleError = () => {
    try {
      if (beginTerminal()) {
        emitNetworkEvent(createXhrTerminalEvent(data, 'Network error', 'error'));
      }
    } catch {
      // ignore
    } finally {
      cleanup();
    }
  };

  const handleTimeout = () => {
    try {
      if (beginTerminal()) {
        emitNetworkEvent(createXhrTerminalEvent(data, 'Request timeout', 'error'));
      }
    } catch {
      // ignore
    } finally {
      cleanup();
    }
  };

  return {
    handleReadyStateChange,
    handleLoadEnd,
    handleError,
    handleTimeout,
    cleanup,
  };
}

export function attachXhrListeners(
  xhr: XMLHttpRequest,
  listeners: ReturnType<typeof createXhrListeners>
) {
  try {
    xhr.addEventListener('readystatechange', listeners.handleReadyStateChange);
    xhr.addEventListener('loadend', listeners.handleLoadEnd);
    xhr.addEventListener('error', listeners.handleError);
    xhr.addEventListener('timeout', listeners.handleTimeout);
    (xhr as ExtendedXHR)._dppRemoveNetworkListeners = listeners.cleanup;
  } catch {
    // ignore
  }
}
