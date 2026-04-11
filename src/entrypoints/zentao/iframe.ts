import { enhanceIframeAttachments } from './attachments';
import { IFRAME_RETRY_DELAYS, logZentao, observeBodyMutations, scheduleRetries } from './shared';

export function runZentaoIframeFlow() {
  logZentao('Running in iframe context');

  function runInjection() {
    const attachments = enhanceIframeAttachments();
    if (attachments > 0) {
      logZentao(`Enhanced: ${attachments} attachments`);
    }
  }

  if (document.body) {
    logZentao('Body ready, starting injection');
    runInjection();
    scheduleRetries(runInjection, IFRAME_RETRY_DELAYS);
    observeBodyMutations(document.body, runInjection);
  }
}
