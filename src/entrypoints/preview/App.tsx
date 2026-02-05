import Peer, { MediaConnection } from 'peerjs';
import { useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { logger } from '@/utils/logger';

type ConnectionStatus = 'waiting' | 'ready' | 'connected' | 'failed';
type Mode = 'host' | 'viewer';

export function App() {
  const [mode] = useState<Mode>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('mode') === 'viewer' ? 'viewer' : 'host';
  });

  return mode === 'host' ? <HostView /> : <ViewerView />;
}

function HostView() {
  const [status, setStatus] = useState<ConnectionStatus>('waiting');
  const [peerId, setPeerId] = useState('');
  const [copied, setCopied] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    const handleMessage = (message: unknown) => {
      const msg = message as Record<string, unknown>;
      if (msg.type !== 'PREVIEW_SIGNAL') return;

      const payload = msg.payload as { signal: { type: string; data?: string }; target: string };
      if (payload.target !== 'preview') return;

      const { signal } = payload;

      if (signal.type === 'PEER_ID_READY' && signal.data) {
        logger.info('Received Peer ID');
        setPeerId(signal.data);
        setStatus('ready');
      }

      if (signal.type === 'CONNECTED') {
        logger.info('Peer connected');
        setStatus('connected');
      }

      if (signal.type === 'LOG' && signal.data) {
        setLogs((prev) => [...prev, `[Offscreen] ${signal.data}`].slice(-50));
      }
    };

    browser.runtime.onMessage.addListener(handleMessage);
    return () => {
      browser.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  async function handleCopyId() {
    await navigator.clipboard.writeText(peerId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-6 text-white flex flex-col">
      <div className="mx-auto max-w-2xl space-y-6 flex-1 w-full">
        <h1 className="text-2xl font-bold">屏幕共享 - 分享者</h1>

        <StatusCard status={status} statusText={getHostStatusText(status)} />

        {status === 'ready' && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-zinc-300">邀请码 (发送给观看者)</p>
            <div className="relative">
              <div className="h-16 w-full flex items-center rounded-lg border border-zinc-700 bg-zinc-800 p-3 font-mono text-xl text-green-400 select-all">
                {peerId}
              </div>
              <button
                type="button"
                onClick={handleCopyId}
                className="absolute right-2 top-4 rounded bg-blue-600 px-4 py-2 text-sm hover:bg-blue-700 font-bold"
              >
                {copied ? '已复制!' : '复制'}
              </button>
            </div>
            <p className="text-xs text-zinc-500 text-center mt-4">
              提示: 观看者输入此号码即可直接连接，无需额外操作。
            </p>
          </div>
        )}

        {status === 'connected' && (
          <div className="rounded-lg border border-green-800 bg-green-900/20 p-8 text-center animate-in fade-in zoom-in duration-300">
            <h2 className="text-2xl font-bold text-green-400 mb-2">正在共享</h2>
            <p className="text-zinc-300">观看者已连接，正在传输画面。</p>
          </div>
        )}
      </div>

      <div className="mt-8 mx-auto max-w-2xl w-full">
        <details className="text-zinc-500">
          <summary className="cursor-pointer hover:text-zinc-300 text-xs mb-2">调试日志</summary>
          <div className="bg-black/50 p-2 rounded text-[10px] font-mono h-32 overflow-y-auto border border-zinc-800">
            {logs.map((log, i) => (
              <div key={i} className="mb-1">
                {log}
              </div>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}

function ViewerView() {
  const [status, setStatus] = useState<ConnectionStatus>('waiting');
  const [targetPeerId, setTargetPeerId] = useState('');
  const [error, setError] = useState('');
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<MediaConnection | null>(null);

  // Initialize PeerJS
  useEffect(() => {
    const peer = new Peer({
      config: {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      },
    });
    peerRef.current = peer;

    peer.on('error', (err) => {
      logger.error('Peer error:', err);
      setError(`连接错误: ${err.type}`);
      setStatus('failed');
    });

    return () => {
      peer.destroy();
    };
  }, []);

  // Attach stream to video
  useEffect(() => {
    if (status === 'connected' && remoteStream && videoRef.current) {
      videoRef.current.srcObject = remoteStream;
      videoRef.current.play().catch(console.error);
    }
  }, [status, remoteStream]);

  function handleConnect() {
    if (!targetPeerId.trim() || !peerRef.current) return;

    setStatus('ready'); // Connecting...
    setError('');

    try {
      logger.info('Calling peer:', targetPeerId);
      // We initiate a call. We don't send a stream (dummy stream not needed for newer PeerJS?)
      // Actually PeerJS usually expects a stream if it's a media call.
      // But we are receiver. PeerJS docs say: peer.call(id, localStream).
      // If we are receive-only, we might need to send a dummy stream or use data connection first?
      // Wait, PeerJS allows one-way calls?
      // Standard WebRTC allows createOffer({ offerToReceiveVideo: true }).
      // PeerJS simplifies this.
      // Let's try sending a dummy black stream to satisfy the API if needed,
      // OR just check if it works without stream (some versions support it).

      // Creating a dummy audio stream to satisfy PeerJS call signature if necessary
      // But actually, for receive-only, we can just answer.
      // Wait, we are the caller. The caller usually provides the stream.
      // If we want to WATCH, the Host should technically CALL US?
      // No, that's inconvenient (Host needs to know Viewer ID).
      // Viewer should CALL Host. But Viewer has no stream.

      // Workaround: Viewer calls Host with a dummy stream (or no stream if allowed).
      // Host answers call with THEIR stream.

      // Let's try creating a dummy stream (canvas or audio)
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const stream = canvas.captureStream(1); // 1 FPS dummy stream

      const call = peerRef.current.call(targetPeerId, stream);
      connRef.current = call;

      call.on('stream', (remoteStream) => {
        logger.info('Received remote stream');
        setRemoteStream(remoteStream);
        setStatus('connected');
      });

      call.on('error', (err) => {
        console.error('Call error:', err);
        setError('呼叫失败');
        setStatus('failed');
      });

      call.on('close', () => {
        logger.info('Call closed');
        setStatus('waiting');
        setRemoteStream(null);
      });
    } catch (e) {
      console.error(e);
      setError('连接尝试失败');
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-6 text-white">
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold">屏幕共享 - 观看者</h1>

        <StatusCard status={status} statusText={getViewerStatusText(status)} />

        {status !== 'connected' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">输入分享者的邀请码</label>
              <input
                type="text"
                value={targetPeerId}
                onChange={(e) => setTargetPeerId(e.target.value)}
                placeholder="例如: dpp-uuid-..."
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 p-3 font-mono text-lg text-white placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none"
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="button"
              onClick={handleConnect}
              disabled={!targetPeerId.trim() || status === 'ready'}
              className="w-full rounded-lg bg-blue-600 py-3 font-bold hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === 'ready' ? '正在连接...' : '连接观看'}
            </button>
          </div>
        )}

        {status === 'connected' && (
          <div className="space-y-4 animate-in fade-in duration-500">
            <div className="aspect-video overflow-hidden rounded-lg border border-zinc-800 bg-black relative shadow-2xl">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                controls
                className="h-full w-full object-contain"
              >
                <track kind="captions" />
              </video>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="text-sm text-zinc-500 hover:text-zinc-300 underline"
            >
              断开连接
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusCard({ status, statusText }: { status: ConnectionStatus; statusText: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-center gap-2">
        <span
          className={`h-3 w-3 rounded-full ${
            status === 'connected'
              ? 'bg-green-500'
              : status === 'ready'
                ? 'bg-yellow-500'
                : status === 'failed'
                  ? 'bg-red-500'
                  : 'bg-zinc-500 animate-pulse'
          }`}
        />
        <span className="text-sm text-zinc-400">{statusText}</span>
      </div>
    </div>
  );
}

function getHostStatusText(status: ConnectionStatus): string {
  switch (status) {
    case 'connected':
      return '正在共享';
    case 'ready':
      return '等待连接';
    default:
      return '正在初始化...';
  }
}

function getViewerStatusText(status: ConnectionStatus): string {
  switch (status) {
    case 'connected':
      return '已连接';
    case 'ready':
      return '正在连接...';
    case 'failed':
      return '连接失败';
    default:
      return '准备连接';
  }
}

export default App;
