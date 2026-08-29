import { installFetchInterceptor } from './fetch';
import { installEventSourceInterceptor } from './sse';
import {
  NETWORK_RESTORE_EVENT,
  type NetworkRuntimeWindow,
  configureNetworkChannelToken,
} from './types';
import { installXHRInterceptor } from './xhr';

export function installNetworkInterceptor(channelToken: string) {
  const runtimeWindow = window as NetworkRuntimeWindow;
  if (runtimeWindow.__dppNetworkInterceptorInstalled) {
    return;
  }
  runtimeWindow.__dppNetworkInterceptorInstalled = true;
  configureNetworkChannelToken(channelToken);

  const restoreFetch = installFetchInterceptor();
  const restoreXHR = installXHRInterceptor();
  const restoreEventSource = installEventSourceInterceptor();

  function restore(event: Event) {
    const customEvent = event as CustomEvent<unknown>;
    const detail = customEvent.detail;
    if (
      !detail ||
      typeof detail !== 'object' ||
      (detail as { channelToken?: unknown }).channelToken !== channelToken
    ) {
      return;
    }
    try {
      restoreFetch();
      restoreXHR();
      restoreEventSource();
    } catch {
      // ignore
    }

    try {
      runtimeWindow.__dppNetworkInterceptorInstalled = false;
      configureNetworkChannelToken('');
      window.removeEventListener(NETWORK_RESTORE_EVENT, restore);
    } catch {
      // ignore
    }
  }

  window.addEventListener(NETWORK_RESTORE_EVENT, restore);
}
