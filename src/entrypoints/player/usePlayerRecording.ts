import { useEffect } from 'react';
import { Replayer } from '@/vendor/rrweb/rrweb.js';
import type { eventWithTime } from '@rrweb/types';
import { loadPlayerDataFromLocation } from './playerShared';

interface UsePlayerRecordingOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  replayerRef: React.RefObject<Replayer | null>;
  eventsRef: React.RefObject<eventWithTime[]>;
  onLoadingChange: (loading: boolean) => void;
  onErrorChange: (error: string | null) => void;
  onRecordingTitleChange: (title: string) => void;
  onHasPlayerChange: (value: boolean) => void;
  onDurationChange: (value: number) => void;
  onCurrentTimeChange: (value: number) => void;
  onIsPlayingChange: (value: boolean) => void;
  onNetworkCountChange: (value: number) => void;
  onConsoleCountChange: (value: number) => void;
}

export function usePlayerRecording({
  containerRef,
  replayerRef,
  eventsRef,
  onLoadingChange,
  onErrorChange,
  onRecordingTitleChange,
  onHasPlayerChange,
  onDurationChange,
  onCurrentTimeChange,
  onIsPlayingChange,
  onNetworkCountChange,
  onConsoleCountChange,
}: UsePlayerRecordingOptions) {
  useEffect(() => {
    let replayer: Replayer | null = null;
    let mounted = true;
    let timeUpdateInterval: number | null = null;

    async function init() {
      try {
        const loaded = await loadPlayerDataFromLocation(window.location.search);
        if (!mounted) {
          return;
        }

        if (!loaded) {
          onLoadingChange(false);
          return;
        }

        onRecordingTitleChange(loaded.title);
        onNetworkCountChange(loaded.networkRequestCount);
        onConsoleCountChange(loaded.consoleLogCount);
        eventsRef.current = loaded.events;

        if (containerRef.current) {
          containerRef.current.innerHTML = '';

          replayer = new Replayer(loaded.events, {
            root: containerRef.current,
            skipInactive: true,
            showWarning: false,
            mouseTail: true,
          });

          replayerRef.current = replayer;
          onDurationChange(replayer.getMetaData().totalTime);

          replayer.on('start', () => {
            if (mounted) {
              onIsPlayingChange(true);
            }
          });
          replayer.on('pause', () => {
            if (mounted) {
              onIsPlayingChange(false);
            }
          });
          replayer.on('finish', () => {
            if (mounted) {
              onIsPlayingChange(false);
            }
          });

          timeUpdateInterval = window.setInterval(() => {
            if (replayer && mounted) {
              try {
                onCurrentTimeChange(replayer.getCurrentTime());
              } catch {
                // ignore
              }
            }
          }, 100);

          replayer.play();
          onHasPlayerChange(true);
        }
      } catch (error) {
        if (mounted) {
          onErrorChange(error instanceof Error ? error.message : String(error));
        }
      } finally {
        if (mounted) {
          onLoadingChange(false);
        }
      }
    }

    void init();

    return () => {
      mounted = false;
      if (timeUpdateInterval) {
        clearInterval(timeUpdateInterval);
      }
      if (replayer) {
        replayer.destroy();
      }
    };
  }, [
    containerRef,
    eventsRef,
    onConsoleCountChange,
    onCurrentTimeChange,
    onDurationChange,
    onErrorChange,
    onHasPlayerChange,
    onIsPlayingChange,
    onLoadingChange,
    onNetworkCountChange,
    onRecordingTitleChange,
    replayerRef,
  ]);
}
