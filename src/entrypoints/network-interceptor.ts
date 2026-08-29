import { installNetworkInterceptor } from './network-interceptor/install';

export default defineUnlistedScript(() => {
  const channelToken =
    document.currentScript instanceof HTMLScriptElement
      ? document.currentScript.dataset.dppChannelToken || ''
      : '';
  installNetworkInterceptor(channelToken);
});
