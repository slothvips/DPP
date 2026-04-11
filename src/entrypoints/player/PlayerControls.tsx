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
    <div className="bg-card border-t px-4 py-3 flex items-center gap-4 shrink-0">
      <Button variant="ghost" size="sm" onClick={onPlayPause} className="w-10 h-10 p-0">
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </Button>
      <span className="text-sm text-muted-foreground w-24 tabular-nums">
        {formatPlaybackTime(currentTime)} / {formatPlaybackTime(duration)}
      </span>
      <input
        type="range"
        min={0}
        max={duration}
        value={currentTime}
        onChange={onSeek}
        className="flex-1 h-2 accent-primary cursor-pointer"
      />
      <div className="flex items-center gap-1">
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
