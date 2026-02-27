import { Allotment, type AllotmentHandle } from 'allotment';
import 'allotment/dist/style.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { db } from '@/db';
import { PlayerSidePanel } from '@/features/recorder/components/PlayerSidePanel';
import { useTheme } from '@/hooks/useTheme';
import { extractConsoleLogs, extractNetworkRequests } from '@/lib/rrweb-plugins';
import { logger } from '@/utils/logger';
import { Replayer } from '@/vendor/rrweb/rrweb.js';
import '@/vendor/rrweb/style.css';
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
  const playerAreaRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const replayerRef = useRef<Replayer | null>(null);
  const allotmentRef = useRef<AllotmentHandle>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recordingTitle, setRecordingTitle] = useState('录制');
  const [hasPlayer, setHasPlayer] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState(true);
  const [networkRequestCount, setNetworkRequestCount] = useState(0);
  const [consoleLogCount, setConsoleLogCount] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [skipInactive, setSkipInactive] = useState(true);
  const eventsRef = useRef<eventWithTime[]>([]);
  const lastAreaWidthRef = useRef<number>(0);

  const getSavedPanelSize = () => {
    const saved = localStorage.getItem('player-side-panel-width');
    return saved ? Number(saved) : 400;
  };

  const savePanelSize = (sizes: number[]) => {
    if (sizes.length === 2 && sizes[1] > 0) {
      localStorage.setItem('player-side-panel-width', String(Math.round(sizes[1])));
    }
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = useCallback(() => {
    if (!replayerRef.current) return;
    if (isPlaying) {
      replayerRef.current.pause();
    } else {
      replayerRef.current.play();
    }
  }, [isPlaying]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!replayerRef.current) return;
    const time = Number(e.target.value);
    replayerRef.current.pause(time);
    setCurrentTime(time);
  }, []);

  const handleSpeedChange = useCallback((newSpeed: number) => {
    if (!replayerRef.current) return;
    replayerRef.current.setConfig({ speed: newSpeed });
    setSpeed(newSpeed);
  }, []);

  const handleSkipInactiveToggle = useCallback(() => {
    if (!replayerRef.current) return;
    const newValue = !skipInactive;
    replayerRef.current.setConfig({ skipInactive: newValue });
    setSkipInactive(newValue);
  }, [skipInactive]);

  // 自适应缩放播放器
  const updateScale = useCallback(() => {
    const doUpdate = () => {
      const playerArea = playerAreaRef.current;
      if (!playerArea || !replayerRef.current) return false;

      const iframe = replayerRef.current.iframe;
      if (!iframe) return false;

      const recWidth = parseInt(iframe.width, 10) || iframe.offsetWidth;
      const recHeight = parseInt(iframe.height, 10) || iframe.offsetHeight;
      if (!recWidth || !recHeight) return false;

      const areaWidth = playerArea.clientWidth;
      const areaHeight = playerArea.clientHeight;
      if (!areaWidth || !areaHeight) return false;

      // 计算缩放比例，保持宽高比，只缩小不放大
      const scaleX = areaWidth / recWidth;
      const scaleY = areaHeight / recHeight;
      const scale = Math.min(scaleX, scaleY, 1);

      // 计算居中偏移
      const scaledWidth = recWidth * scale;
      const scaledHeight = recHeight * scale;
      const offsetX = (areaWidth - scaledWidth) / 2;
      const offsetY = (areaHeight - scaledHeight) / 2;

      const wrapper = containerRef.current;
      if (wrapper) {
        wrapper.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
        wrapper.style.transformOrigin = 'top left';
        wrapper.style.width = `${recWidth}px`;
        wrapper.style.height = `${recHeight}px`;
      }
      return true;
    };

    // 使用 requestAnimationFrame 确保在浏览器完成布局后执行
    requestAnimationFrame(() => {
      if (!doUpdate()) {
        // 如果更新失败（尺寸为0），延迟重试
        setTimeout(() => requestAnimationFrame(doUpdate), 100);
      }
    });
  }, []);

  // 初始化播放器
  useEffect(() => {
    let replayer: Replayer | null = null;
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

        const firstEvent = events[0] as unknown;
        const needsUnpack =
          typeof firstEvent === 'string' ||
          Array.isArray(firstEvent) ||
          (typeof firstEvent === 'object' && firstEvent !== null && !('type' in firstEvent));

        if (needsUnpack) {
          try {
            events = events.map((e) => unpack(e as unknown as string)) as unknown as RRWebEvent[];
          } catch (e) {
            logger.warn('Failed to unpack events, assuming raw:', e);
          }
        }

        eventsRef.current = events as eventWithTime[];

        const networkRequests = extractNetworkRequests(events as eventWithTime[]);
        setNetworkRequestCount(networkRequests.length);

        const consoleLogs = extractConsoleLogs(events as eventWithTime[]);
        setConsoleLogCount(consoleLogs.length);

        if (containerRef.current) {
          containerRef.current.innerHTML = '';

          replayer = new Replayer(events as eventWithTime[], {
            root: containerRef.current,
            skipInactive: true,
            showWarning: false,
            mouseTail: true,
          });

          replayerRef.current = replayer;

          const metadata = replayer.getMetaData();
          setDuration(metadata.totalTime);

          replayer.on('start', () => {
            if (mounted) setIsPlaying(true);
          });
          replayer.on('pause', () => {
            if (mounted) setIsPlaying(false);
          });
          replayer.on('finish', () => {
            if (mounted) setIsPlaying(false);
          });

          timeUpdateInterval = window.setInterval(() => {
            if (replayer && mounted) {
              try {
                setCurrentTime(replayer.getCurrentTime());
              } catch {
                // ignore
              }
            }
          }, 100);

          replayer.play();
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
      if (timeUpdateInterval) clearInterval(timeUpdateInterval);
      if (replayer) replayer.destroy();
    };
  }, []);

  // 监听容器大小变化，更新缩放
  useEffect(() => {
    if (!hasPlayer || !replayerRef.current) return;

    // 初始加载时多次延迟更新，确保布局完成
    const timers = [50, 100, 200, 300, 500, 800, 1000, 1500].map((delay) =>
      setTimeout(updateScale, delay)
    );

    // 监听 playerArea 和 main 容器的尺寸变化
    const resizeObserver = new ResizeObserver(() => {
      // 检测 playerArea 宽度是否变化
      const currentWidth = playerAreaRef.current?.clientWidth || 0;
      if (currentWidth !== lastAreaWidthRef.current) {
        lastAreaWidthRef.current = currentWidth;
        updateScale();
      }
    });

    if (playerAreaRef.current) {
      resizeObserver.observe(playerAreaRef.current);
    }
    if (mainRef.current) {
      resizeObserver.observe(mainRef.current);
    }

    return () => {
      timers.forEach(clearTimeout);
      resizeObserver.disconnect();
    };
  }, [hasPlayer, updateScale]);

  // 侧边栏显示状态变化时更新缩放
  useEffect(() => {
    if (hasPlayer) {
      // 多次延迟执行以等待 Allotment 布局完全更新
      const timers = [0, 50, 100, 200, 300].map((delay) => setTimeout(updateScale, delay));
      return () => timers.forEach(clearTimeout);
    }
  }, [showSidePanel, hasPlayer, updateScale]);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground font-sans">
      {/* 顶部标题栏 */}
      <header className="bg-card border-b px-6 py-3 flex justify-between items-center shadow-sm shrink-0">
        <h1 className="font-semibold text-lg truncate">{recordingTitle}</h1>
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

      {/* 主内容区 */}
      <main ref={mainRef} className="flex-1 flex overflow-hidden">
        <Allotment ref={allotmentRef} onDragEnd={savePanelSize} onChange={updateScale}>
          {/* 播放器区域 */}
          <Allotment.Pane>
            <div className="h-full flex flex-col min-w-0">
              {loading && (
                <div className="flex-1 flex items-center justify-center text-muted-foreground text-lg">
                  正在加载录制...
                </div>
              )}

              {error && (
                <div className="flex-1 flex items-center justify-center p-4">
                  <div className="text-destructive bg-destructive/10 p-4 rounded-md border border-destructive/20">
                    错误: {error}
                  </div>
                </div>
              )}

              {!loading && !error && !hasPlayer && (
                <div className="flex-1 flex items-center justify-center p-4">
                  <div className="text-muted-foreground border-2 border-dashed border-border rounded-lg p-12 text-center">
                    <p>未加载录制。</p>
                    <p className="text-sm mt-2">请从扩展程序弹窗中打开录制。</p>
                  </div>
                </div>
              )}

              {/* 播放器容器 */}
              <div
                ref={playerAreaRef}
                className="flex-1 min-h-0 overflow-hidden bg-neutral-900 relative"
              >
                <div ref={containerRef} className="absolute" />
              </div>

              {/* 播放控制栏 */}
              {hasPlayer && (
                <div className="bg-card border-t px-4 py-3 flex items-center gap-4 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handlePlayPause}
                    className="w-10 h-10 p-0"
                  >
                    {isPlaying ? <PauseIcon /> : <PlayIcon />}
                  </Button>
                  <span className="text-sm text-muted-foreground w-24 tabular-nums">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={duration}
                    value={currentTime}
                    onChange={handleSeek}
                    className="flex-1 h-2 accent-primary cursor-pointer"
                  />
                  <div className="flex items-center gap-1">
                    {[0.5, 1, 2, 4].map((s) => (
                      <Button
                        key={s}
                        variant={speed === s ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => handleSpeedChange(s)}
                        className="px-2 text-xs"
                      >
                        {s}x
                      </Button>
                    ))}
                    <span className="w-px h-4 bg-border mx-1" />
                    <Button
                      variant={skipInactive ? 'default' : 'ghost'}
                      size="sm"
                      onClick={handleSkipInactiveToggle}
                      className="px-2 text-xs"
                    >
                      跳过空闲
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Allotment.Pane>

          {/* 右侧开发者工具面板 - 使用条件渲染 */}
          {showSidePanel && hasPlayer && (
            <Allotment.Pane preferredSize={getSavedPanelSize()} minSize={300} maxSize={800}>
              <PlayerSidePanel
                events={eventsRef.current}
                networkCount={networkRequestCount}
                consoleCount={consoleLogCount}
                currentTime={currentTime}
                onClose={() => setShowSidePanel(false)}
              />
            </Allotment.Pane>
          )}
        </Allotment>
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

function PlayIcon() {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
  );
}
