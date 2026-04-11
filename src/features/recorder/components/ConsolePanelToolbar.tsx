import {
  LOG_LEVELS,
  type LogLevel,
  getLevelButtonStyle,
} from '@/features/recorder/components/consolePanelShared';
import { getLevelIcon } from '@/lib/rrweb-plugins';
import { cn } from '@/utils/cn';

interface ConsolePanelToolbarProps {
  filter: string;
  onFilterChange: (value: string) => void;
  statusCounts: {
    past: number;
    active: number;
    future: number;
  };
  levelFilter: Set<LogLevel>;
  levelCounts: Record<LogLevel, number>;
  onToggleLevel: (level: LogLevel) => void;
  onClearLevels: () => void;
}

export function ConsolePanelToolbar({
  filter,
  onFilterChange,
  statusCounts,
  levelFilter,
  levelCounts,
  onToggleLevel,
  onClearLevels,
}: ConsolePanelToolbarProps) {
  return (
    <div className="flex flex-col gap-2 p-2 border-b bg-muted/30">
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="过滤日志..."
          value={filter}
          onChange={(event) => onFilterChange(event.target.value)}
          className="flex-1 px-2 py-1 text-sm border rounded bg-background"
        />
        <div className="flex items-center gap-2 text-xs">
          <span className="text-success dark:text-success">{statusCounts.past}</span>
          <span className="text-muted-foreground">/</span>
          <span className="text-primary">{statusCounts.active}</span>
          <span className="text-muted-foreground">/</span>
          <span className="text-muted-foreground">{statusCounts.future}</span>
        </div>
      </div>

      <div className="flex items-center gap-1 flex-wrap">
        {LOG_LEVELS.map((level) => (
          <button
            key={level}
            onClick={() => onToggleLevel(level)}
            className={cn(
              'px-2 py-0.5 text-xs rounded transition-colors flex items-center gap-1',
              levelFilter.size === 0 || levelFilter.has(level)
                ? getLevelButtonStyle(level)
                : 'bg-muted/50 text-muted-foreground'
            )}
          >
            <span>{getLevelIcon(level)}</span>
            <span>{level}</span>
            {levelCounts[level] > 0 && (
              <span className="ml-0.5 text-muted-foreground">({levelCounts[level]})</span>
            )}
          </button>
        ))}
        {levelFilter.size > 0 && (
          <button
            onClick={onClearLevels}
            className="px-2 py-0.5 text-xs rounded bg-muted text-muted-foreground hover:bg-muted/80"
          >
            清除
          </button>
        )}
      </div>
    </div>
  );
}
