import { type NetworkRequestData, generateRequestId } from './types';
import { getUrlString, headersToObject, processHeaders, serializeBody } from './utils';

export function resolveRequestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  try {
    if (init?.method) {
      return init.method.toUpperCase();
    }
    if (input instanceof Request) {
      return input.method.toUpperCase();
    }
  } catch {
    // ignore
  }

  return 'GET';
}

export function resolveRequestHeaders(
  input: RequestInfo | URL,
  init?: RequestInit
): Record<string, string> | undefined {
  try {
    if (init?.headers instanceof Headers) {
      return processHeaders(headersToObject(init.headers));
    }
    if (Array.isArray(init?.headers)) {
      return processHeaders(Object.fromEntries(init.headers));
    }
    if (init?.headers) {
      return processHeaders(init.headers as Record<string, string>);
    }
    if (input instanceof Request) {
      return processHeaders(headersToObject(input.headers));
    }
  } catch {
    // ignore
  }

  return undefined;
}

export function createFetchNetworkData(
  input: RequestInfo | URL,
  init?: RequestInit
): NetworkRequestData {
  return {
    id: generateRequestId(),
    type: 'fetch',
    method: resolveRequestMethod(input, init),
    url: getUrlString(input),
    startTime: Date.now(),
    phase: 'start',
  };
}

export function assignFetchRequestData(
  networkData: NetworkRequestData,
  input: RequestInfo | URL,
  init?: RequestInit
) {
  const requestHeaders = resolveRequestHeaders(input, init);
  if (requestHeaders) {
    networkData.requestHeaders = requestHeaders;
  }

  try {
    if (init?.body) {
      networkData.requestBody = serializeBody(init.body);
    } else if (input instanceof Request && input.body) {
      networkData.requestBody = '[Request body - cannot read without consuming]';
    }
  } catch {
    // ignore
  }
}

export function restoreFetch(originalFetch: typeof fetch) {
  try {
    Object.defineProperty(window, 'fetch', {
      value: originalFetch,
      writable: true,
      configurable: true,
      enumerable: true,
    });
  } catch {
    try {
      window.fetch = originalFetch;
    } catch {
      // ignore
    }
  }
}
