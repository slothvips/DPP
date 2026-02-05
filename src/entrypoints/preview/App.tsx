import { useEffect, useRef } from 'react';
import { browser } from 'wxt/browser';
import { PreviewSignalMessage } from '@/features/recorder/messages';
import { logger } from '@/utils/logger';

export function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    pcRef.current = pc;

    pc.ontrack = (event) => {
      logger.info('Track received:', event.streams[0]);
      if (videoRef.current) {
        videoRef.current.srcObject = event.streams[0];
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        browser.runtime
          .sendMessage({
            type: 'PREVIEW_SIGNAL',
            payload: {
              signal: event.candidate,
              target: 'offscreen',
            },
          })
          .catch(() => {});
      }
    };

    const handleMessage = async (message: unknown) => {
      const isPreviewSignal = (m: unknown): m is PreviewSignalMessage => {
        if (typeof m !== 'object' || m === null) return false;
        const msg = m as Record<string, unknown>;
        const payload = msg.payload as Record<string, unknown> | undefined;
        return msg.type === 'PREVIEW_SIGNAL' && payload?.target === 'preview';
      };

      if (!isPreviewSignal(message)) return;

      const { signal } = message.payload;

      try {
        if ((signal as RTCSessionDescriptionInit).type === 'offer') {
          logger.info('Received offer');
          await pc.setRemoteDescription(
            new RTCSessionDescription(signal as RTCSessionDescriptionInit)
          );

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          await browser.runtime.sendMessage({
            type: 'PREVIEW_SIGNAL',
            payload: {
              signal: answer,
              target: 'offscreen',
            },
          });
        } else if ((signal as RTCIceCandidateInit).candidate) {
          logger.info('Received ICE candidate');
          await pc.addIceCandidate(new RTCIceCandidate(signal as RTCIceCandidateInit));
        }
      } catch (error) {
        logger.error('Error handling signaling message:', error);
      }
    };

    browser.runtime.onMessage.addListener(handleMessage);

    // Notify offscreen that we are ready (in case it's waiting or we missed the start)
    browser.runtime
      .sendMessage({
        type: 'PREVIEW_SIGNAL',
        payload: {
          signal: { type: 'READY_FOR_OFFER' },
          target: 'offscreen',
        },
      })
      .catch(() => {});

    return () => {
      browser.runtime.onMessage.removeListener(handleMessage);
      pc.close();
      pcRef.current = null;
    };
  }, []);

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-zinc-950 p-4 text-white">
      <div className="relative flex aspect-video w-full max-w-5xl items-center justify-center overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 shadow-2xl">
        <video ref={videoRef} autoPlay muted controls className="h-full w-full object-contain" />
        <div className="absolute inset-0 -z-10 flex items-center justify-center text-zinc-700">
          <span className="animate-pulse">Waiting for stream...</span>
        </div>
      </div>
    </div>
  );
}

export default App;
