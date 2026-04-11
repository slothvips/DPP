import type { eventWithTime } from '@rrweb/types';
import { PlayerSidePanelContent } from './PlayerSidePanelContent';
import { PlayerSidePanelHeader } from './PlayerSidePanelHeader';
import { usePlayerSidePanel } from './usePlayerSidePanel';

interface PlayerSidePanelProps {
  events: eventWithTime[];
  currentTime?: number;
  networkCount?: number;
  consoleCount?: number;
  actionsCount?: number;
  onClose: () => void;
}

export function PlayerSidePanel({
  events,
  currentTime,
  networkCount = 0,
  consoleCount = 0,
  actionsCount = 0,
  onClose,
}: PlayerSidePanelProps) {
  const { activeTab, setActiveTab, tabs } = usePlayerSidePanel({
    networkCount,
    consoleCount,
    actionsCount,
  });

  return (
    <div className="flex flex-col h-full bg-background border-l">
      <PlayerSidePanelHeader
        activeTab={activeTab}
        onClose={onClose}
        onTabChange={setActiveTab}
        tabs={tabs}
      />
      <PlayerSidePanelContent activeTab={activeTab} currentTime={currentTime} events={events} />
    </div>
  );
}
