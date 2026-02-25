import { useState } from 'react';
import { cn } from '@/utils/cn';
import type { eventWithTime } from '@rrweb/types';
import { NetworkPanel } from './NetworkPanel';

export type PanelTab = 'network' | 'console' | 'actions';

interface TabConfig {
  id: PanelTab;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  disabled?: boolean;
}

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
  const [activeTab, setActiveTab] = useState<PanelTab>('network');

  const tabs: TabConfig[] = [
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
      disabled: true,
    },
    {
      id: 'actions',
      label: '用户行为',
      icon: <ActionsIcon />,
      badge: actionsCount,
      disabled: true,
    },
  ];

  return (
    <div className="flex flex-col h-full bg-background border-l">
      {/* 面板头部 */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => !tab.disabled && setActiveTab(tab.id)}
              disabled={tab.disabled}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors',
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground'
                  : tab.disabled
                    ? 'text-muted-foreground/50 cursor-not-allowed'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span
                  className={cn(
                    'ml-1 px-1.5 py-0.5 text-xs rounded-full',
                    activeTab === tab.id
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
          title="关闭面板"
        >
          <CloseIcon />
        </button>
      </div>

      {/* 面板内容 */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'network' && <NetworkPanel events={events} currentTime={currentTime} />}
        {activeTab === 'console' && (
          <ComingSoonPanel title="控制台录制" description="即将支持录制和回放控制台日志" />
        )}
        {activeTab === 'actions' && (
          <ComingSoonPanel title="用户行为录制" description="即将支持录制和回放用户操作序列" />
        )}
      </div>
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

function NetworkIcon() {
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

function ConsoleIcon() {
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

function ActionsIcon() {
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

function CloseIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
