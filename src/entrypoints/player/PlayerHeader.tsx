import { Button } from '@/components/ui/button';
import { PanelIcon } from './PlayerIcons';

interface PlayerHeaderProps {
  loading: boolean;
  error: string | null;
  hasPlayer: boolean;
  showSidePanel: boolean;
  recordingTitle: string;
  onToggleSidePanel: () => void;
}

export function PlayerHeader({
  loading,
  error,
  hasPlayer,
  showSidePanel,
  recordingTitle,
  onToggleSidePanel,
}: PlayerHeaderProps) {
  return (
    <header className="bg-card border-b px-6 py-3 flex justify-between items-center shadow-sm shrink-0">
      <h1 className="font-semibold text-lg truncate">{recordingTitle}</h1>
      <div className="flex items-center gap-2">
        {!loading && !error && hasPlayer && (
          <Button
            variant={showSidePanel ? 'default' : 'outline'}
            size="sm"
            onClick={onToggleSidePanel}
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
  );
}
