import { installNetworkInterceptor } from './network-interceptor/install';

export default defineUnlistedScript(() => {
  installNetworkInterceptor();
});
