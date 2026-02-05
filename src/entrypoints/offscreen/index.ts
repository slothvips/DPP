import { logger } from '@/utils/logger';

export default defineUnlistedScript(() => {
  browser.runtime.onMessage.addListener((message) => {
    if (message.target === 'offscreen' && message.type === 'START_RECORDING') {
      void (async () => {
        try {
          const stream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
          });
          logger.info('Stream ID:', stream.id);
        } catch (error) {
          logger.error('Failed to get display media:', error);
        }
      })();
    }
  });
});
