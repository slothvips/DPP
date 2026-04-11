import { useMemo, useState } from 'react';
import { createPlayerSidePanelTabs } from './playerSidePanelShared';

interface UsePlayerSidePanelOptions {
  networkCount: number;
  consoleCount: number;
  actionsCount: number;
}

export function usePlayerSidePanel({
  networkCount,
  consoleCount,
  actionsCount,
}: UsePlayerSidePanelOptions) {
  const [activeTab, setActiveTab] = useState<'network' | 'console' | 'actions'>('network');

  const tabs = useMemo(
    () =>
      createPlayerSidePanelTabs({
        networkCount,
        consoleCount,
        actionsCount,
      }),
    [actionsCount, consoleCount, networkCount]
  );

  return {
    activeTab,
    setActiveTab,
    tabs,
  };
}
