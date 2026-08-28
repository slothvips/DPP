import { Button } from '@/components/ui/button';
import { PauseIcon, PlayIcon } from './PlayerIcons';
import { formatPlaybackTime } from './playerShared';

interface PlayerControlsProps {
  hasPlayer: boolean;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  speed: number;
  skipInactive: boolean;
  onPlayPause: () => void;
  onSeek: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSpeedChange: (speed: number) => void;
  onToggleSkipInactive: () => void;
}

export function PlayerControls({
  hasPlayer,
  isPlaying,
  currentTime,
  duration,
  speed,
  skipInactive,
  onPlayPause,
  onSeek,
  onSpeedChange,
  onToggleSkipInactive,
}: PlayerControlsProps) {
  if (!hasPlayer) {
    return null;
  }

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-3 border-t bg-card px-4 py-3">
      <Button variant="ghost" size="sm" onClick={onPlayPause} className="h-10 w-10 shrink-0 p-0">
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </Button>
      <span className="w-auto shrink-0 text-sm tabular-nums text-muted-foreground">
        {formatPlaybackTime(currentTime)} / {formatPlaybackTime(duration)}
      </span>
      <input
        type="range"
        min={0}
        max={duration}
        value={currentTime}
        onChange={onSeek}
        className="h-2 min-w-24 flex-[1_1_8rem] cursor-pointer accent-primary"
      />
      <div className="flex min-w-0 flex-wrap items-center gap-1">
        {[0.5, 1, 2, 4].map((value) => (
          <Button
            key={value}
            variant={speed === value ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onSpeedChange(value)}
            className="px-2 text-xs"
          >
            {value}x
          </Button>
        ))}
        <span className="w-px h-4 bg-border mx-1" />
        <Button
          variant={skipInactive ? 'default' : 'ghost'}
          size="sm"
          onClick={onToggleSkipInactive}
          className="px-2 text-xs"
        >
          跳过空闲
        </Button>
      </div>
    </div>
  );
}
