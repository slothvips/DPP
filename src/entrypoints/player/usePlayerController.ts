import type { AllotmentHandle } from 'allotment';
import { useCallback, useRef, useState } from 'react';
import { useTheme } from '@/hooks/useTheme';
import type { Replayer } from '@/vendor/rrweb/rrweb.js';
import type { eventWithTime } from '@rrweb/types';
import { usePlayerRecording } from './usePlayerRecording';
import { usePlayerScale } from './usePlayerScale';

export function usePlayerController() {
  useTheme();

  const containerRef = useRef<HTMLDivElement>(null);
  const playerAreaRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const replayerRef = useRef<Replayer | null>(null);
  const allotmentRef = useRef<AllotmentHandle>(null);
  const eventsRef = useRef<eventWithTime[]>([]);
  const seekTimeRef = useRef(0);

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

  usePlayerRecording({
    containerRef,
    replayerRef,
    eventsRef,
    onLoadingChange: setLoading,
    onErrorChange: setError,
    onRecordingTitleChange: setRecordingTitle,
    onHasPlayerChange: setHasPlayer,
    onDurationChange: setDuration,
    onCurrentTimeChange: setCurrentTime,
    onIsPlayingChange: setIsPlaying,
    onNetworkCountChange: setNetworkRequestCount,
    onConsoleCountChange: setConsoleLogCount,
  });

  const { updateScale } = usePlayerScale({
    hasPlayer,
    showSidePanel,
    playerAreaRef,
    containerRef,
    mainRef,
    replayerRef,
  });

  const handlePlayPause = useCallback(() => {
    if (!replayerRef.current) {
      return;
    }

    if (isPlaying) {
      replayerRef.current.pause();
    } else {
      replayerRef.current.play(seekTimeRef.current);
    }
  }, [isPlaying]);

  const handleSeek = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (!replayerRef.current) {
      return;
    }

    const time = Number(event.target.value);
    seekTimeRef.current = time;
    replayerRef.current.pause(time);
    setCurrentTime(time);
  }, []);

  const handleSpeedChange = useCallback((newSpeed: number) => {
    if (!replayerRef.current) {
      return;
    }

    replayerRef.current.setConfig({ speed: newSpeed });
    setSpeed(newSpeed);
  }, []);

  const handleSkipInactiveToggle = useCallback(() => {
    if (!replayerRef.current) {
      return;
    }

    const nextValue = !skipInactive;
    replayerRef.current.setConfig({ skipInactive: nextValue });
    setSkipInactive(nextValue);
  }, [skipInactive]);

  return {
    containerRef,
    playerAreaRef,
    mainRef,
    allotmentRef,
    eventsRef,
    loading,
    error,
    recordingTitle,
    hasPlayer,
    showSidePanel,
    networkRequestCount,
    consoleLogCount,
    currentTime,
    duration,
    isPlaying,
    speed,
    skipInactive,
    setShowSidePanel,
    updateScale,
    handlePlayPause,
    handleSeek,
    handleSpeedChange,
    handleSkipInactiveToggle,
  };
}
