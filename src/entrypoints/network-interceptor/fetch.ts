import { populateFetchErrorData, populateFetchResponseData } from './fetchResponse';
import { assignFetchRequestData, createFetchNetworkData, restoreFetch } from './fetchShared';
import { emitNetworkEvent, isExtensionUrl } from './utils';

export function installFetchInterceptor(): () => void {
  const originalFetch = window.fetch;

  const wrappedFetch = async function (
    this: typeof globalThis,
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const networkData = createFetchNetworkData(input, init);
    if (isExtensionUrl(networkData.url)) {
      return originalFetch.apply(this, [input, init]);
    }

    assignFetchRequestData(networkData, input, init);
    emitNetworkEvent(networkData);

    try {
      const response = await originalFetch.apply(this, [input, init]);

      try {
        await populateFetchResponseData(response, networkData);
      } catch {
        // ignore
      }

      emitNetworkEvent(networkData);
      return response;
    } catch (error) {
      try {
        populateFetchErrorData(networkData, error);
      } catch {
        // ignore
      }

      emitNetworkEvent(networkData);
      throw error;
    }
  };

  try {
    Object.defineProperty(window, 'fetch', {
      value: wrappedFetch,
      writable: true,
      configurable: true,
      enumerable: true,
    });
    Object.setPrototypeOf(wrappedFetch, originalFetch);
  } catch {
    window.fetch = wrappedFetch as typeof fetch;
  }

  return () => {
    restoreFetch(originalFetch);
  };
}
