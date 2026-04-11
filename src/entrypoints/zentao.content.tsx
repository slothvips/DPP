import { runZentaoIframeFlow } from './zentao/iframe';
import { runZentaoMainFrameFlow } from './zentao/mainFrame';
import { logZentao } from './zentao/shared';

export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: true,
  runAt: 'document_idle',
  main() {
    const currentUrl = window.location.href;
    const isInIframe = window !== window.top;

    logZentao('Init:', currentUrl, 'iframe:', isInIframe);

    if (isInIframe) {
      runZentaoIframeFlow();
      return;
    }

    runZentaoMainFrameFlow();
  },
});
