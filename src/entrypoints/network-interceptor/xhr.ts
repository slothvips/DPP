import { generateRequestId } from './types';
import { emitNetworkEvent, isExtensionUrl } from './utils';
import {
  assignXhrRequestBody,
  attachXhrListeners,
  createXhrListeners,
  emitXhrStartEvent,
} from './xhrListeners';
import { type ExtendedXHR, createXhrTerminalEvent } from './xhrShared';

export function installXHRInterceptor(): () => void {
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
  const originalAbort = XMLHttpRequest.prototype.abort;

  XMLHttpRequest.prototype.open = function (
    this: ExtendedXHR,
    method: string,
    url: string | URL,
    async: boolean = true,
    username?: string | null,
    password?: string | null
  ) {
    try {
      const resolvedUrl = url.toString();
      if (!isExtensionUrl(resolvedUrl)) {
        this._dppNetworkData = {
          id: generateRequestId(),
          method: method.toUpperCase(),
          url: resolvedUrl,
          startTime: Date.now(),
          requestHeaders: {},
        };
      }
    } catch {
      // ignore
    }

    return originalOpen.call(this, method, url, async, username, password);
  };

  XMLHttpRequest.prototype.setRequestHeader = function (
    this: ExtendedXHR,
    name: string,
    value: string
  ) {
    try {
      if (this._dppNetworkData) {
        this._dppNetworkData.requestHeaders[name] = value;
      }
    } catch {
      // ignore
    }

    return originalSetRequestHeader.call(this, name, value);
  };

  XMLHttpRequest.prototype.abort = function (this: ExtendedXHR) {
    try {
      if (this._dppNetworkData) {
        emitNetworkEvent(createXhrTerminalEvent(this._dppNetworkData, 'Request aborted', 'abort'));
        this._dppNetworkData = undefined;
      }
    } catch {
      // ignore
    }

    return originalAbort.call(this);
  };

  XMLHttpRequest.prototype.send = function (
    this: ExtendedXHR,
    body?: Document | XMLHttpRequestBodyInit | null
  ) {
    const data = this._dppNetworkData;

    if (data) {
      assignXhrRequestBody(this, body);
      emitXhrStartEvent(data);

      const listeners = createXhrListeners({
        xhr: this,
        data,
      });
      attachXhrListeners(this, listeners);
    }

    return originalSend.call(this, body);
  };

  return () => {
    try {
      XMLHttpRequest.prototype.open = originalOpen;
      XMLHttpRequest.prototype.send = originalSend;
      XMLHttpRequest.prototype.setRequestHeader = originalSetRequestHeader;
      XMLHttpRequest.prototype.abort = originalAbort;
    } catch {
      // ignore
    }
  };
}
