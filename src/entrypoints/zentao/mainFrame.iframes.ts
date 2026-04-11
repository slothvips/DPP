import { injectIntoZentaoDocument } from './mainFrame.injection';
import { IFRAME_CHECK_DELAYS, logZentao, scheduleRetries } from './shared';

function processIframe(iframe: HTMLIFrameElement) {
  try {
    const iframeDocument = iframe.contentDocument;
    const iframeWindow = iframe.contentWindow;

    if (!iframeDocument || !iframeWindow) {
      logZentao('Cannot access iframe content (cross-origin or not ready)');
      return;
    }

    logZentao('Processing iframe:', iframe.src || iframe.id);
    injectIntoZentaoDocument(iframeDocument);
  } catch (error) {
    logZentao('Error accessing iframe:', error);
  }
}

export function checkZentaoIframes() {
  const iframes = document.querySelectorAll<HTMLIFrameElement>(
    '#apps iframe, .app-container iframe'
  );
  logZentao(`Found ${iframes.length} app iframes`);

  for (const iframe of iframes) {
    if (iframe.dataset.dppProcessed) {
      continue;
    }

    const tryProcess = () => {
      try {
        if (iframe.contentDocument?.readyState === 'complete') {
          iframe.dataset.dppProcessed = 'true';
          processIframe(iframe);
        } else {
          setTimeout(tryProcess, 500);
        }
      } catch (error) {
        logZentao('Iframe not ready yet, retrying...', error);
        setTimeout(tryProcess, 500);
      }
    };

    iframe.addEventListener('load', () => {
      logZentao('Iframe load event fired');
      setTimeout(() => {
        iframe.dataset.dppProcessed = 'true';
        processIframe(iframe);
      }, 100);
    });

    tryProcess();
  }
}

export function startZentaoIframeMonitoring() {
  if (document.body) {
    scheduleRetries(checkZentaoIframes, IFRAME_CHECK_DELAYS);
    const observer = new MutationObserver(() => {
      setTimeout(checkZentaoIframes, 200);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
}
