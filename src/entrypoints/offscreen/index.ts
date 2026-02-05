import { logger } from '@/utils/logger';

export default defineUnlistedScript(() => {
  browser.runtime.onMessage.addListener((message) => {
    if (message.target === 'offscreen' && message.type === 'START_RECORDING') {
      void (async () => {
        try {
          const { streamId } = message;
          let stream: MediaStream;

          if (streamId) {
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                mandatory: {
                  chromeMediaSource: 'desktop',
                  chromeMediaSourceId: streamId,
                },
              } as unknown as MediaTrackConstraints,
            });
          } else {
            stream = await navigator.mediaDevices.getDisplayMedia({
              video: true,
            });
          }
          logger.info('Success! Got stream with ID:', stream.id);
        } catch (error) {
          logger.error('Failed to get stream:', error);
        }
      })();
    }
  });
});
