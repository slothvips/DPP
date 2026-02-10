import Peer from 'peerjs';
import { useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
    <div className="min-h-screen bg-background p-6 text-foreground flex flex-col">
      <div className="mx-auto max-w-2xl space-y-6 flex-1 w-full">
        <h1 className="text-2xl font-bold">屏幕共享 - 分享者</h1>

        <StatusCard status={status} statusText={getHostStatusText(status)} />

        {status === 'ready' && (
          <div className="space-y-2">
            <label htmlFor="peer-id-display" className="text-sm font-medium text-muted-foreground">
              邀请码 (发送给观看者)
            </label>
            <div className="relative">
              <div
                id="peer-id-display"
                className="h-12 w-full flex items-center rounded-md border border-input bg-muted/50 px-3 font-mono text-lg text-green-600 dark:text-green-400 select-all"
              >
                {peerId}
              </div>
              <Button
                type="button"
                onClick={handleCopyId}
                className="absolute right-1 top-1 h-10 px-3"
              >
                {copied ? '已复制!' : '复制'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center mt-4">
              提示: 观看者输入此号码即可直接连接，无需额外操作。
            </p>
          </div>
        )}

        {status === 'connected' && (
          <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-8 text-center animate-in fade-in zoom-in duration-300">
            <h2 className="text-2xl font-bold text-green-600 dark:text-green-400 mb-2">正在共享</h2>
            <p className="text-muted-foreground">观看者已连接，正在传输画面。</p>
          </div>
        )}
      </div>

      <div className="mt-8 mx-auto max-w-2xl w-full">
        <details className="text-muted-foreground">
          <summary className="cursor-pointer hover:text-foreground text-xs mb-2">调试日志</summary>
          <div className="bg-muted p-2 rounded text-[10px] font-mono h-32 overflow-y-auto border border-border">
            {logs.map((log, i) => (
              <div key={`${i}-${log.slice(0, 5)}`} className="mb-1">
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
      videoRef.current.play().catch(logger.error);
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

      call.on('stream', (remoteStream) => {
        logger.info('Received remote stream');
        setRemoteStream(remoteStream);
        setStatus('connected');
      });

      call.on('error', (err) => {
        logger.error('Call error:', err);
        setError('呼叫失败');
        setStatus('failed');
      });

      call.on('close', () => {
        logger.info('Call closed');
        setStatus('waiting');
        setRemoteStream(null);
      });
    } catch (e) {
      logger.error(e);
      setError('连接尝试失败');
    }
  }

  return (
    <div className="min-h-screen bg-background p-6 text-foreground">
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold">屏幕共享 - 观看者</h1>

        <StatusCard status={status} statusText={getViewerStatusText(status)} />

        {status !== 'connected' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="peer-id-input-viewer"
                className="text-sm font-medium text-muted-foreground"
              >
                输入分享者的邀请码
              </label>
              <Input
                id="peer-id-input-viewer"
                type="text"
                value={targetPeerId}
                onChange={(e) => setTargetPeerId(e.target.value)}
                placeholder="例如: dpp-uuid-..."
                className="font-mono text-lg h-12"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button
              type="button"
              onClick={handleConnect}
              disabled={!targetPeerId.trim() || status === 'ready'}
              className="w-full h-12 text-lg"
            >
              {status === 'ready' ? '正在连接...' : '连接观看'}
            </Button>
          </div>
        )}

        {status === 'connected' && (
          <div className="space-y-4 animate-in fade-in duration-500">
            <div className="aspect-video overflow-hidden rounded-lg border border-border bg-black relative shadow-2xl">
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
            <Button
              variant="destructive"
              onClick={() => window.location.reload()}
              className="w-full shadow-lg hover:bg-destructive/90 transition-all"
            >
              断开连接
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusCard({ status, statusText }: { status: ConnectionStatus; statusText: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <span
          className={`h-3 w-3 rounded-full ${
            status === 'connected'
              ? 'bg-green-500'
              : status === 'ready'
                ? 'bg-yellow-500'
                : status === 'failed'
                  ? 'bg-destructive'
                  : 'bg-muted-foreground animate-pulse'
          }`}
        />
        <span className="text-sm text-muted-foreground">{statusText}</span>
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
