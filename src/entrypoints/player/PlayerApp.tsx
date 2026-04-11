import 'allotment/dist/style.css';
import '@/vendor/rrweb/style.css';
import { PlayerHeader } from './PlayerHeader';
import { PlayerLayout } from './PlayerLayout';
import './rrweb-player-theme.css';
import { usePlayerController } from './usePlayerController';

export function PlayerApp() {
  const {
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
  } = usePlayerController();

  return (
    <div className="flex flex-col h-screen bg-background text-foreground font-sans">
      <PlayerHeader
        loading={loading}
        error={error}
        hasPlayer={hasPlayer}
        showSidePanel={showSidePanel}
        recordingTitle={recordingTitle}
        onToggleSidePanel={() => setShowSidePanel((value) => !value)}
      />

      <PlayerLayout
        mainRef={mainRef}
        allotmentRef={allotmentRef}
        playerAreaRef={playerAreaRef}
        containerRef={containerRef}
        events={eventsRef.current}
        loading={loading}
        error={error}
        hasPlayer={hasPlayer}
        showSidePanel={showSidePanel}
        networkRequestCount={networkRequestCount}
        consoleLogCount={consoleLogCount}
        currentTime={currentTime}
        duration={duration}
        isPlaying={isPlaying}
        speed={speed}
        skipInactive={skipInactive}
        onUpdateScale={updateScale}
        onPlayPause={handlePlayPause}
        onSeek={handleSeek}
        onSpeedChange={handleSpeedChange}
        onToggleSkipInactive={handleSkipInactiveToggle}
        onCloseSidePanel={() => setShowSidePanel(false)}
      />
    </div>
  );
}
