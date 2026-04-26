import { Bot, Plus, Scissors, Settings, Trash2 } from 'lucide-react';
import { YoloButton } from '@/components/YoloButton';
import { Button } from '@/components/ui/button';
import type { AISession } from '../types';
import { AIConfigDialog } from './AIConfigDialog';
import { AISessionList } from './AISessionList';

interface AIAssistantHeaderProps {
  sessions: AISession[];
  currentSessionId: string | null;
  isRunning: boolean;
  canClear: boolean;
  canSummarize: boolean;
  isSummarizing: boolean;
  onSelectSession: (id: string) => Promise<void>;
  onDeleteSession: (id: string) => Promise<void>;
  onCreateSession: () => Promise<void>;
  onConfigSaved: () => void;
  onSummarize: () => void;
  onClear: () => void;
}

export function AIAssistantHeader({
  sessions,
  currentSessionId,
  isRunning,
  canClear,
  canSummarize,
  isSummarizing,
  onSelectSession,
  onDeleteSession,
  onCreateSession,
  onConfigSaved,
  onSummarize,
  onClear,
}: AIAssistantHeaderProps) {
  return (
    <div className="border-b border-border/55 bg-info/6 px-3 py-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-info/9 text-info ring-1 ring-info/12">
            <Bot className="h-4.5 w-4.5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-foreground">D仔</h2>
            <p className="text-xs text-muted-foreground">协助你处理本地数据与页面任务</p>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-2xl bg-background/60 p-1 ring-1 ring-border/35">
          <YoloButton />
          <AIConfigDialog onSaved={onConfigSaved}>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 rounded-xl"
              title="AI 设置"
              data-testid="ai-config-button"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </AIConfigDialog>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 rounded-xl"
            onClick={onSummarize}
            disabled={!canSummarize || isSummarizing}
            title="压缩当前会话到新会话"
          >
            <Scissors className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 rounded-xl"
            onClick={onClear}
            disabled={!canClear}
            title="清空当前会话对话"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <AISessionList
          sessions={sessions}
          currentSessionId={currentSessionId}
          onSelectSession={onSelectSession}
          onDeleteSession={onDeleteSession}
          disabled={isRunning}
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={onCreateSession}
          disabled={isRunning}
          title={isRunning ? '请等待 D仔 完成当前任务' : '新建会话'}
          className="h-8 rounded-xl border border-border/55 bg-background/78 px-3 text-xs"
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          新建会话
        </Button>
      </div>
    </div>
  );
}
