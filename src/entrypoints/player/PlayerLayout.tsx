import { Allotment, type AllotmentHandle } from 'allotment';
import { PlayerSidePanel } from '@/features/recorder/components/PlayerSidePanel';
import type { eventWithTime } from '@rrweb/types';
import { PlayerContent } from './PlayerContent';
import { PlayerControls } from './PlayerControls';
import { getSavedPanelSize, savePanelSize } from './playerShared';

interface PlayerLayoutProps {
  mainRef: React.RefObject<HTMLElement | null>;
  allotmentRef: React.RefObject<AllotmentHandle | null>;
  playerAreaRef: React.RefObject<HTMLDivElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  events: eventWithTime[];
  loading: boolean;
  error: string | null;
  hasPlayer: boolean;
  showSidePanel: boolean;
  networkRequestCount: number;
  consoleLogCount: number;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  speed: number;
  skipInactive: boolean;
  onUpdateScale: () => void;
  onPlayPause: () => void;
  onSeek: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSpeedChange: (newSpeed: number) => void;
  onToggleSkipInactive: () => void;
  onCloseSidePanel: () => void;
}

export function PlayerLayout({
  mainRef,
  allotmentRef,
  playerAreaRef,
  containerRef,
  events,
  loading,
  error,
  hasPlayer,
  showSidePanel,
  networkRequestCount,
  consoleLogCount,
  currentTime,
  duration,
  isPlaying,
  speed,
  skipInactive,
  onUpdateScale,
  onPlayPause,
  onSeek,
  onSpeedChange,
  onToggleSkipInactive,
  onCloseSidePanel,
}: PlayerLayoutProps) {
  return (
    <main ref={mainRef} className="flex-1 flex overflow-hidden">
      <Allotment ref={allotmentRef} onDragEnd={savePanelSize} onChange={onUpdateScale}>
        <Allotment.Pane>
          <div className="h-full flex flex-col min-w-0">
            <PlayerContent
              loading={loading}
              error={error}
              hasPlayer={hasPlayer}
              playerAreaRef={playerAreaRef}
              containerRef={containerRef}
            />
            <PlayerControls
              hasPlayer={hasPlayer}
              isPlaying={isPlaying}
              currentTime={currentTime}
              duration={duration}
              speed={speed}
              skipInactive={skipInactive}
              onPlayPause={onPlayPause}
              onSeek={onSeek}
              onSpeedChange={onSpeedChange}
              onToggleSkipInactive={onToggleSkipInactive}
            />
          </div>
        </Allotment.Pane>

        {showSidePanel && hasPlayer && (
          <Allotment.Pane preferredSize={getSavedPanelSize()} minSize={300} maxSize={800}>
            <PlayerSidePanel
              events={events}
              networkCount={networkRequestCount}
              consoleCount={consoleLogCount}
              currentTime={currentTime}
              onClose={onCloseSidePanel}
            />
          </Allotment.Pane>
        )}
      </Allotment>
    </main>
  );
}
