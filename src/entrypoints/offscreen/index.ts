import { logger } from '@/utils/logger';

export default defineUnlistedScript(() => {
  let pc: RTCPeerConnection | null = null;

  async function setupWebRTC(stream: MediaStream) {
    pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    if (!pc) return;
    for (const track of stream.getTracks()) {
      pc.addTrack(track, stream);
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        browser.runtime
          .sendMessage({
            type: 'PREVIEW_SIGNAL',
            payload: { signal: event.candidate, target: 'preview' },
          })
          .catch(() => {});
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await browser.runtime.sendMessage({
      type: 'PREVIEW_SIGNAL',
      payload: { signal: offer, target: 'preview' },
    });
  }

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

          await setupWebRTC(stream);
          await browser.runtime.sendMessage({ type: 'PREVIEW_OPEN' });
        } catch (error) {
          logger.error('Failed to get stream:', error);
        }
      })();
    }

    if (message.type === 'PREVIEW_SIGNAL' && message.payload?.target === 'offscreen') {
      void (async () => {
        const { signal } = message.payload;
        try {
          if (signal.type === 'answer') {
            await pc?.setRemoteDescription(new RTCSessionDescription(signal));
          } else if (signal.candidate) {
            await pc?.addIceCandidate(new RTCIceCandidate(signal));
          }
        } catch (e) {
          logger.error('Error handling preview signal:', e);
        }
      })();
    }
  });
});
