import { runJenkinsHeadlessAuth } from './jenkins/auth';
import { observeJenkinsTokenGeneration } from './jenkins/ui';

export default defineContentScript({
  matches: ['*://*/*'],
  runAt: 'document_idle',
  main() {
    if (location.hash === '#dpp-auth') {
      void runJenkinsHeadlessAuth();
      return;
    }

    if (location.href.includes('/configure')) {
      observeJenkinsTokenGeneration();
    }
  },
});
