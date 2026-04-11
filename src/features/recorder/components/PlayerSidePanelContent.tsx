import type { eventWithTime } from '@rrweb/types';
import { ConsolePanel } from './ConsolePanel';
import { NetworkPanel } from './NetworkPanel';
import type { PanelTab } from './playerSidePanelShared';

interface PlayerSidePanelContentProps {
  activeTab: PanelTab;
  currentTime?: number;
  events: eventWithTime[];
}

export function PlayerSidePanelContent({
  activeTab,
  currentTime,
  events,
}: PlayerSidePanelContentProps) {
  return (
    <div className="flex-1 min-h-0 overflow-hidden">
      {activeTab === 'network' && <NetworkPanel events={events} currentTime={currentTime} />}
      {activeTab === 'console' && <ConsolePanel events={events} currentTime={currentTime} />}
      {activeTab === 'actions' && (
        <ComingSoonPanel title="用户行为录制" description="即将支持录制和回放用户操作序列" />
      )}
    </div>
  );
}

function ComingSoonPanel({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <div className="w-16 h-16 mb-4 rounded-full bg-muted flex items-center justify-center">
        <svg
          className="w-8 h-8 text-muted-foreground"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 6v6m0 0v6m0-6h6m-6 0H6"
          />
        </svg>
      </div>
      <h3 className="text-lg font-medium mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
