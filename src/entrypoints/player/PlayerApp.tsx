import rrwebPlayer from 'rrweb-player';
import 'rrweb-player/dist/style.css';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { db } from '@/db';
import { useTheme } from '@/hooks/useTheme';
import { logger } from '@/utils/logger';
import { unpack } from '@rrweb/packer';
import './rrweb-player-theme.css';

interface RRWebEvent {
  type: number;
  timestamp: number;
  data: unknown;
}

export function PlayerApp() {
  useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recordingTitle, setRecordingTitle] = useState('录制');
  const [hasPlayer, setHasPlayer] = useState(false);

  useEffect(() => {
    let instance: rrwebPlayer | null = null;
    let mounted = true;

    const init = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const id = params.get('id');
        const url = params.get('url');
        const cacheId = params.get('cache');

        let events: RRWebEvent[] = [];

        if (id) {
          const recording = await db.recordings.get(id);
          if (!recording) throw new Error('未找到录制记录');
          events = recording.events as unknown as RRWebEvent[];
          if (mounted) setRecordingTitle(recording.title);
        } else if (cacheId) {
          const res = (await browser.runtime.sendMessage({
            type: 'REMOTE_RECORDING_GET',
            payload: { cacheId },
          })) as { success: boolean; events?: unknown[]; title?: string; error?: string };

          if (!res.success || !res.events) {
            if (!mounted) return;
            throw new Error(res.error || '加载缓存录制失败');
          }
          events = res.events as RRWebEvent[];
          if (mounted) setRecordingTitle(res.title || '远程录制');
        } else if (url) {
          const res = await fetch(url);
          if (!res.ok) throw new Error('加载录制文件失败');
          events = (await res.json()) as RRWebEvent[];
          if (mounted) setRecordingTitle('外部录制');
        } else {
          if (mounted) setLoading(false);
          return;
        }

        if (!mounted) return;

        if (events.length === 0) {
          throw new Error('录制内容为空 (0 个事件)');
        }

        // Handle unpacking if events are compressed
        // Check first event to see if it needs unpacking
        const firstEvent = events[0] as unknown;
        const looksLikePacked =
          events.length > 0 &&
          typeof firstEvent !== 'string' &&
          !('type' in (firstEvent as object));

        if (looksLikePacked) {
          try {
            events = events.map((e) => unpack(e as unknown as string)) as unknown as RRWebEvent[];
          } catch (e) {
            logger.warn('Failed to unpack events, assuming raw:', e);
          }
        } else {
          events = events.map((e) => {
            if (Array.isArray(e)) {
              return unpack(e as unknown as string);
            }
            return e;
          }) as unknown as RRWebEvent[];
        }

        if (containerRef.current) {
          containerRef.current.innerHTML = '';

          // Get viewport dimensions
          const width = window.innerWidth;
          const height = window.innerHeight - 52; // Subtract header height

          instance = new rrwebPlayer({
            target: containerRef.current,
            props: {
              events,
              width,
              height,
              autoPlay: true,
              showController: true,
            },
          });
          setHasPlayer(true);
        }
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    return () => {
      mounted = false;
      if (instance) {
        (instance as unknown as { $destroy: () => void }).$destroy();
      }
    };
  }, []);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground font-sans">
      <header className="bg-card border-b px-6 py-3 flex justify-between items-center shadow-sm shrink-0">
        <h1 className="font-semibold text-lg">{recordingTitle}</h1>
        {!loading && !error && (
          <Button variant="outline" size="sm" onClick={() => window.close()}>
            关闭
          </Button>
        )}
      </header>
      <main className="flex-1 flex flex-col justify-center items-center overflow-hidden p-0">
        {loading && <div className="text-muted-foreground text-lg">正在加载录制...</div>}

        {error && (
          <div className="text-destructive bg-destructive/10 p-4 rounded-md border border-destructive/20">
            错误: {error}
          </div>
        )}

        {!loading && !error && !hasPlayer && (
          <div className="text-muted-foreground border-2 border-dashed border-border rounded-lg p-12 text-center">
            <p>未加载录制。</p>
            <p className="text-sm mt-2">请从扩展程序弹窗中打开录制。</p>
          </div>
        )}

        <div ref={containerRef} className="rrweb-player-container w-full h-full" />
      </main>
    </div>
  );
}
