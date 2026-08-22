import { Bot, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AISession } from '../types';
import { AISessionList } from './AISessionList';

interface AIAssistantHeaderProps {
  sessions: AISession[];
  currentSessionId: string | null;
  isRunning: boolean;
  isConfigMissing: boolean;
  onSelectSession: (id: string) => Promise<void>;
  onDeleteSession: (id: string) => Promise<void>;
  onCreateSession: () => Promise<void>;
}

export function AIAssistantHeader({
  sessions,
  currentSessionId,
  isRunning,
  isConfigMissing,
  onSelectSession,
  onDeleteSession,
  onCreateSession,
}: AIAssistantHeaderProps) {
  return (
    <header className="border-b border-border/60 bg-background px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <Bot className="h-4 w-4" />
        </div>
        <h1 className="shrink-0 text-sm font-semibold tracking-tight text-foreground">D 仔</h1>
        <AISessionList
          sessions={sessions}
          currentSessionId={currentSessionId}
          onSelectSession={onSelectSession}
          onDeleteSession={onDeleteSession}
          disabled={isRunning}
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={onCreateSession}
          disabled={isRunning}
          title={isRunning ? '请等待 D仔 完成当前任务' : '新建会话'}
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
        </div>
      </div>
    </header>
  );
}
