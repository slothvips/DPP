import rrwebPlayer from 'rrweb-player';
import 'rrweb-player/dist/style.css';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { db } from '@/db';
import { PlayerSidePanel } from '@/features/recorder/components/PlayerSidePanel';
import { usePanelResize } from '@/hooks/usePanelResize';
import { useTheme } from '@/hooks/useTheme';
import { extractConsoleLogs, extractNetworkRequests } from '@/lib/rrweb-plugins';
import { logger } from '@/utils/logger';
import { unpack } from '@rrweb/packer';
import type { eventWithTime } from '@rrweb/types';
import './rrweb-player-theme.css';

interface RRWebEvent {
  type: number;
  timestamp: number;
  data: unknown;
}

export function PlayerApp() {
  useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const playerRef = useRef<rrwebPlayer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recordingTitle, setRecordingTitle] = useState('录制');
  const [hasPlayer, setHasPlayer] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [networkRequestCount, setNetworkRequestCount] = useState(0);
  const [consoleLogCount, setConsoleLogCount] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const eventsRef = useRef<eventWithTime[]>([]);

  const { value: sidePanelWidth, handleProps } = usePanelResize({
    initialValue: 500,
    min: 300,
    max: 800,
    unit: 'px',
    direction: 'left',
  });

  useEffect(() => {
    let instance: rrwebPlayer | null = null;
    let mounted = true;
    let timeUpdateInterval: number | null = null;

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

        // Store events in ref for resize handler (after unpacking)
        eventsRef.current = events as eventWithTime[];

        // Count network requests (after unpacking)
        const networkRequests = extractNetworkRequests(events as eventWithTime[]);
        setNetworkRequestCount(networkRequests.length);

        // Count console logs (after unpacking)
        const consoleLogs = extractConsoleLogs(events as eventWithTime[]);
        setConsoleLogCount(consoleLogs.length);

        if (containerRef.current) {
          containerRef.current.innerHTML = '';

          // Get container dimensions
          const rect = containerRef.current.getBoundingClientRect();
          const width = rect.width;
          // rrwebPlayer 的 height 参数是 iframe 部分的高度，不包括控制栏
          // 需要减去控制栏的高度（约 80px）
          const CONTROLLER_HEIGHT = 80;
          const height = Math.max(rect.height - CONTROLLER_HEIGHT, 100);

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

          playerRef.current = instance;

          // 定时更新当前播放时间
          timeUpdateInterval = window.setInterval(() => {
            if (instance && mounted) {
              try {
                const replayer = instance.getReplayer();
                if (replayer) {
                  const time = replayer.getCurrentTime();
                  setCurrentTime(time);
                }
              } catch {
                // ignore
              }
            }
          }, 100);

          // Handle resize
          const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
              const { width: newWidth, height: newHeight } = entry.contentRect;
              if (instance && newWidth > 0 && newHeight > 0) {
                // Recreate player with new dimensions
                (instance as unknown as { $destroy: () => void }).$destroy();
                containerRef.current!.innerHTML = '';
                instance = new rrwebPlayer({
                  target: containerRef.current!,
                  props: {
                    events: eventsRef.current,
                    width: newWidth,
                    height: Math.max(newHeight - CONTROLLER_HEIGHT, 100),
                    autoPlay: true,
                    showController: true,
                  },
                });
                playerRef.current = instance;
              }
            }
          });
          resizeObserver.observe(containerRef.current);
          resizeObserverRef.current = resizeObserver;

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
      if (timeUpdateInterval) {
        clearInterval(timeUpdateInterval);
      }
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      if (instance) {
        (instance as unknown as { $destroy: () => void }).$destroy();
      }
    };
  }, []);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground font-sans">
      <header className="bg-card border-b px-6 py-3 flex justify-between items-center shadow-sm shrink-0">
        <h1 className="font-semibold text-lg">{recordingTitle}</h1>
        <div className="flex items-center gap-2">
          {!loading && !error && hasPlayer && (
            <Button
              variant={showSidePanel ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowSidePanel(!showSidePanel)}
            >
              <PanelIcon />
              <span className="ml-1.5">开发者工具</span>
            </Button>
          )}
          {!loading && !error && (
            <Button variant="outline" size="sm" onClick={() => window.close()}>
              关闭
            </Button>
          )}
        </div>
      </header>
      <main className="flex-1 flex overflow-hidden p-0">
        <div className="flex-1 flex flex-col min-w-0">
          {loading && <div className="text-muted-foreground text-lg p-4">正在加载录制...</div>}

          {error && (
            <div className="text-destructive bg-destructive/10 p-4 rounded-md border border-destructive/20 m-4">
              错误: {error}
            </div>
          )}

          {!loading && !error && !hasPlayer && (
            <div className="text-muted-foreground border-2 border-dashed border-border rounded-lg p-12 text-center m-4">
              <p>未加载录制。</p>
              <p className="text-sm mt-2">请从扩展程序弹窗中打开录制。</p>
            </div>
          )}

          <div ref={containerRef} className="rrweb-player-container flex-1 min-h-0" />
        </div>

        {/* 右侧开发者工具面板 */}
        {showSidePanel && hasPlayer && (
          <div className="flex shrink-0" style={{ width: sidePanelWidth }}>
            {/* 拖拽手柄 */}
            <div {...handleProps} />
            <div className="flex-1 min-w-0">
              <PlayerSidePanel
                events={eventsRef.current}
                networkCount={networkRequestCount}
                consoleCount={consoleLogCount}
                currentTime={currentTime}
                onClose={() => setShowSidePanel(false)}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function PanelIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
      />
    </svg>
  );
}
