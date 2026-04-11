import { installFetchInterceptor } from './fetch';
import { installEventSourceInterceptor } from './sse';
import { NETWORK_RESTORE_EVENT, type NetworkRuntimeWindow } from './types';
import { installXHRInterceptor } from './xhr';

export function installNetworkInterceptor() {
  const runtimeWindow = window as NetworkRuntimeWindow;
  if (runtimeWindow.__dppNetworkInterceptorInstalled) {
    return;
  }
  runtimeWindow.__dppNetworkInterceptorInstalled = true;

  const restoreFetch = installFetchInterceptor();
  const restoreXHR = installXHRInterceptor();
  const restoreEventSource = installEventSourceInterceptor();

  function restore() {
    try {
      restoreFetch();
      restoreXHR();
      restoreEventSource();
    } catch {
      // ignore
    }

    try {
      runtimeWindow.__dppNetworkInterceptorInstalled = false;
    } catch {
      // ignore
    }
  }

  window.addEventListener(NETWORK_RESTORE_EVENT, restore, { once: true });
}
