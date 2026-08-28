import { Bot, Library, MessageSquare, Plus, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AIChatStatus } from '../hooks/useAIChat.types';
import type { AISession } from '../types';
import { AIConfigDialog } from './AIConfigDialog';
import { AISessionList } from './AISessionList';

export type AIAssistantViewMode = 'chat' | 'materials';

interface AIAssistantHeaderProps {
  sessions: AISession[];
  currentSessionId: string | null;
  sessionStatuses: Record<string, AIChatStatus>;
  isRunning: boolean;
  isConfigMissing: boolean;
  onConfigSaved: () => void;
  onSelectSession: (id: string) => Promise<void>;
  onDeleteSession: (id: string) => Promise<void>;
  onCreateSession: () => Promise<void>;
  viewMode: AIAssistantViewMode;
  onViewModeChange: (mode: AIAssistantViewMode) => void;
}

export function AIAssistantHeader({
  sessions,
  currentSessionId,
  sessionStatuses,
  isRunning,
  isConfigMissing,
  onConfigSaved,
  onSelectSession,
  onDeleteSession,
  onCreateSession,
  viewMode,
  onViewModeChange,
}: AIAssistantHeaderProps) {
  return (
    <header className="relative z-40 min-w-0 shrink-0 border-b border-border/60 bg-background px-3 py-2">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <Bot className="h-4 w-4" />
        </div>
        <h1 className="shrink-0 text-sm font-semibold tracking-tight text-foreground">D 仔</h1>
        <div
          className="flex shrink-0 items-center gap-0.5 rounded-lg border border-border/50 bg-muted/25 p-0.5"
          role="tablist"
          aria-label="D 仔视图"
        >
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'chat'}
            className={`flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${viewMode === 'chat' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
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
            className={`flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${viewMode === 'materials' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => onViewModeChange('materials')}
            title="物料库"
          >
            <Library className="h-3.5 w-3.5" />
            <span>物料库</span>
          </button>
        </div>
        <div className="min-w-0 max-w-[180px] flex-1 basis-24">
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

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <span
            className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-medium ${
              isConfigMissing
                ? 'bg-warning/10 text-warning'
                : isRunning
                  ? 'bg-info/10 text-info'
                  : 'bg-success/10 text-success'
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {isConfigMissing ? '待配置' : isRunning ? '工作中' : '已配置'}
          </span>
          <AIConfigDialog onSaved={onConfigSaved}>
            <Button
              variant="ghost"
              size="icon"
              disabled={isRunning}
              className="h-8 w-8 rounded-lg border border-border/55 bg-muted/35 text-muted-foreground"
              title="AI 设置"
              data-testid="ai-config-button"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </AIConfigDialog>
        </div>
      </div>
    </header>
  );
}
