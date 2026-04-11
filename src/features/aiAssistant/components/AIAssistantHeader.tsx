import { Plus, Scissors, Settings, Trash2 } from 'lucide-react';
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
    <div className="flex items-center justify-between px-3 py-2 border-b">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">D仔</span>
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
          className="text-xs h-7"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          新建会话
        </Button>
      </div>
      <div className="flex items-center gap-1">
        <YoloButton />
        <AIConfigDialog onSaved={onConfigSaved}>
          <Button variant="ghost" size="sm" title="AI 设置" data-testid="ai-config-button">
            <Settings className="w-4 h-4" />
          </Button>
        </AIConfigDialog>
        <Button
          variant="ghost"
          size="sm"
          onClick={onSummarize}
          disabled={!canSummarize || isSummarizing}
          title="压缩当前会话到新会话"
        >
          <Scissors className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          disabled={!canClear}
          title="清空当前会话对话"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
