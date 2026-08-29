import { logger } from '@/utils/logger';
import { observeJenkinsTokenGeneration } from './jenkins/ui';

export default defineContentScript({
  matches: ['*://*/*'],
  runAt: 'document_idle',
  async main() {
    if (!location.pathname.includes('/configure')) return;

    try {
      const response = (await browser.runtime.sendMessage({
        type: 'JENKINS_VALIDATE_CONTENT_ORIGIN',
      })) as { success?: boolean; allowed?: boolean };
      if (!response.success || !response.allowed) return;
      observeJenkinsTokenGeneration();
    } catch (error) {
      logger.debug('Jenkins content origin validation failed:', error);
    }
  },
});
