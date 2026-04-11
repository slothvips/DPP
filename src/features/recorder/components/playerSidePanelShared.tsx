import type { ReactNode } from 'react';

export type PanelTab = 'network' | 'console' | 'actions';

export interface TabConfig {
  id: PanelTab;
  label: string;
  icon: ReactNode;
  badge?: number;
  disabled?: boolean;
}

interface CreatePlayerSidePanelTabsOptions {
  networkCount: number;
  consoleCount: number;
  actionsCount: number;
}

export function createPlayerSidePanelTabs({
  networkCount,
  consoleCount,
  actionsCount,
}: CreatePlayerSidePanelTabsOptions): TabConfig[] {
  return [
    {
      id: 'network',
      label: '网络',
      icon: <NetworkIcon />,
      badge: networkCount,
    },
    {
      id: 'console',
      label: '控制台',
      icon: <ConsoleIcon />,
      badge: consoleCount,
    },
    {
      id: 'actions',
      label: '用户行为',
      icon: <ActionsIcon />,
      badge: actionsCount,
      disabled: true,
    },
  ];
}

export function NetworkIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
      />
    </svg>
  );
}

export function ConsoleIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

export function ActionsIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
      />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
