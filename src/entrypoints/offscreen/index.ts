import Peer from 'peerjs';
import { browser } from 'wxt/browser';
import { logger } from '@/utils/logger';

let peer: Peer | null = null;
let currentStream: MediaStream | null = null;

function broadcastLog(message: string, data?: unknown) {
  const logMsg = data ? `${message} ${JSON.stringify(data)}` : message;
  logger.info(message, data);
  browser.runtime
    .sendMessage({
      type: 'PREVIEW_SIGNAL',
      payload: { signal: { type: 'LOG', data: logMsg }, target: 'preview' },
    })
    .catch(() => {});
}

async function setupPeer(stream: MediaStream) {
  currentStream = stream;

  // Cleanup old peer if exists
  if (peer) {
    peer.destroy();
  }

  // Create a new Peer with a random ID
  // Using public PeerJS server (free)
  peer = new Peer({
    debug: 2,
    config: {
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    },
  });

  peer.on('open', (id) => {
    broadcastLog('PeerJS initialized with ID:', id);
    // Send ID to UI
    browser.runtime
      .sendMessage({
        type: 'PREVIEW_SIGNAL',
        payload: { signal: { type: 'PEER_ID_READY', data: id }, target: 'preview' },
      })
      .catch(() => {});
  });

  peer.on('call', (call) => {
    broadcastLog('Incoming call from:', call.peer);

    // Answer the call with the stream
    call.answer(stream);

    call.on('stream', () => {
      // We don't expect a stream back, but just in case
    });

    call.on('close', () => {
      broadcastLog('Call ended');
    });

    call.on('error', (err) => {
      broadcastLog('Call error:', err);
    });

    broadcastLog('Answered call, streaming started');

    // Notify UI that someone connected
    browser.runtime
      .sendMessage({
        type: 'PREVIEW_SIGNAL',
        payload: { signal: { type: 'CONNECTED' }, target: 'preview' },
      })
      .catch(() => {});
  });

  peer.on('error', (err) => {
    broadcastLog('PeerJS Error:', err.type);
    logger.error('PeerJS Error:', err);
  });

  peer.on('disconnected', () => {
    broadcastLog('PeerJS disconnected from server');
  });
}

browser.runtime.onMessage.addListener((message) => {
  if (message.target === 'offscreen' && message.type === 'START_RECORDING') {
    void (async () => {
      try {
        broadcastLog('Requesting stream via getDisplayMedia (High Quality)');
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: 3840, max: 3840 },
            height: { ideal: 2160, max: 2160 },
            frameRate: { ideal: 60, max: 60 },
            displaySurface: 'monitor', // Prefer monitor sharing for best quality
          },
          audio: {
            autoGainControl: false,
            echoCancellation: false,
            noiseSuppression: false, // High quality audio
            sampleRate: 48000,
          },
        });

        broadcastLog('Got stream, initializing PeerJS');
        await browser.runtime.sendMessage({ type: 'PREVIEW_OPEN' });
        await setupPeer(stream);
      } catch (error) {
        broadcastLog('Failed to get stream:', error);
      }
    })();
  }
});

logger.info('Offscreen document loaded and ready');
