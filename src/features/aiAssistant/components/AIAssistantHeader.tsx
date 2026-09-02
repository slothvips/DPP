import { Library, MessageSquare, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import type { AIChatStatus } from '../hooks/useAIChat.types';
import type { AISession } from '../types';
import { AISessionList } from './AISessionList';

export type AIAssistantViewMode = 'chat' | 'materials';

interface AIAssistantHeaderProps {
  isActive: boolean;
  sessions: AISession[];
  currentSessionId: string | null;
  sessionStatuses: Record<string, AIChatStatus>;
  onSelectSession: (id: string) => Promise<void>;
  onDeleteSession: (id: string) => Promise<void>;
  onCreateSession: () => Promise<void>;
  viewMode: AIAssistantViewMode;
  onViewModeChange: (mode: AIAssistantViewMode) => void;
}

export function AIAssistantHeader({
  isActive,
  sessions,
  currentSessionId,
  sessionStatuses,
  onSelectSession,
  onDeleteSession,
  onCreateSession,
  viewMode,
  onViewModeChange,
}: AIAssistantHeaderProps) {
  const [toolbarTarget, setToolbarTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setToolbarTarget(isActive ? document.getElementById('sidepanel-ai-toolbar-slot') : null);
  }, [isActive]);

  if (!toolbarTarget) return null;

  return createPortal(
    <div className="flex min-w-0 items-center gap-1.5">
      <div className="flex shrink-0 items-center gap-1">
        <div
          className="flex min-w-0 items-center gap-0.5 rounded-lg border border-border/50 bg-muted/25 p-0.5"
          role="tablist"
          aria-label="D 仔视图"
        >
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'chat'}
            className={`flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${viewMode === 'chat' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => onViewModeChange('chat')}
            title="对话"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>对话</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'materials'}
            className={`flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${viewMode === 'materials' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => onViewModeChange('materials')}
            title="物料库"
          >
            <Library className="h-3.5 w-3.5" />
            <span>物料库</span>
          </button>
        </div>
      </div>
      <div className="flex min-w-[8rem] flex-[0_1_auto] items-center gap-1">
        <div className="min-w-0 flex-1">
          <AISessionList
            sessions={sessions}
            currentSessionId={currentSessionId}
            sessionStatuses={sessionStatuses}
            onSelectSession={onSelectSession}
            onDeleteSession={onDeleteSession}
          />
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onCreateSession}
          title="新建会话"
          className="h-8 w-8 shrink-0 rounded-lg border border-border/55 bg-muted/35 text-muted-foreground"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>,
    toolbarTarget
  );
}
