import { GripHorizontal, Scissors, Settings, Trash2 } from 'lucide-react';
import { YoloButton } from '@/components/YoloButton';
import { Button } from '@/components/ui/button';
import type { AIProviderType, TokenUsage } from '@/lib/ai/types';
import { AIConfigDialog } from './AIConfigDialog';
import { AIUsageIndicator } from './AIUsageIndicator';
import { ChatInput } from './ChatInput';

interface AIAssistantInputSectionProps {
  isConfigMissing: boolean;
  currentProvider: AIProviderType | null;
  currentProviderName: string | null;
  currentModel: string | null;
  isRunning: boolean;
  isConfirming: boolean;
  presetPrompt: string;
  presetPromptKey?: string;
  usage?: TokenUsage;
  canClear: boolean;
  canSummarize: boolean;
  isSummarizing: boolean;
  onConfigSaved: () => void;
  onSend: (content: string) => Promise<void>;
  onFileError?: (message: string) => void;
  onStop: () => void;
  onSummarize: () => void;
  onClear: () => void;
}

export function AIAssistantInputSection({
  isConfigMissing,
  currentProvider,
  currentProviderName,
  currentModel,
  isRunning,
  isConfirming,
  presetPrompt,
  presetPromptKey,
  usage,
  canClear,
  canSummarize,
  isSummarizing,
  onConfigSaved,
  onSend,
  onFileError,
  onStop,
  onSummarize,
  onClear,
}: AIAssistantInputSectionProps) {
  const disabled = isConfirming;

  return (
    <div className="relative flex h-full min-h-[220px] flex-col border-t border-border/60 bg-background p-3 backdrop-blur">
      <div
        className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 text-muted-foreground/55"
        title="拖动上边缘调整输入区高度"
        aria-hidden="true"
      >
        <GripHorizontal className="h-3 w-8" />
      </div>
      {isConfigMissing && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-warning/20 bg-warning/6 px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-warning">连接 AI 服务后开始对话</p>
            <AIConfigDialog onSaved={onConfigSaved}>
              <Button
                variant="ghost"
                size="sm"
                disabled={isRunning}
                className="h-7 rounded-lg text-xs text-warning"
              >
                去配置
              </Button>
            </AIConfigDialog>
          </div>
        </div>
      )}

      <div className="mb-2 min-w-0 border-b border-border/45 px-1 pb-2 text-[11px] text-muted-foreground">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <div className="flex min-w-[10rem] flex-[1_1_15rem] items-center gap-2">
            <span className="shrink-0 font-medium text-foreground/70">供应商</span>
            <span className="min-w-0 truncate font-medium text-foreground/90">
              {currentProviderName || currentProvider || '未连接'}
            </span>
            <span className="text-muted-foreground/60">/</span>
            <span className="shrink-0 font-medium text-foreground/70">模型</span>
            <span
              className="min-w-0 truncate font-medium text-foreground/90"
              title={currentModel || undefined}
            >
              {currentModel || '未设置'}
            </span>
            <AIConfigDialog onSaved={onConfigSaved}>
              <Button
                variant="ghost"
                size="icon"
                disabled={isRunning}
                className="h-7 w-7 shrink-0 rounded-md text-muted-foreground"
                aria-label="AI 设置"
                title="AI 设置"
                data-testid="ai-config-button"
              >
                <Settings className="h-3.5 w-3.5" />
              </Button>
            </AIConfigDialog>
          </div>
          <div className="flex min-w-0 shrink-0 items-center gap-2">
            <span className="shrink-0 font-medium text-foreground/70">当前会话上下文</span>
            <AIUsageIndicator usage={usage} />
          </div>
        </div>
      </div>

      <div className="min-h-[120px] flex-1 rounded-2xl border border-border/70 bg-muted/20 p-2 shadow-sm">
        <ChatInput
          onSend={onSend}
          onStop={onStop}
          disabled={disabled}
          isRunning={isRunning}
          queueWhileRunning={isRunning}
          placeholder="发送消息... (Shift+Enter 换行)"
          initialInput={presetPrompt}
          initialInputKey={presetPromptKey}
          onFileError={onFileError}
          leftSlot={
            <div className="flex flex-wrap items-center gap-0.5 rounded-lg border border-border/50 bg-background/90 p-0.5 shadow-sm">
              <YoloButton compact disabled={isRunning} />
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-md text-muted-foreground"
                onClick={onSummarize}
                disabled={isRunning || !canSummarize || isSummarizing}
                title="压缩当前会话到新会话"
              >
                <Scissors className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-md text-muted-foreground"
                onClick={onClear}
                disabled={isRunning || !canClear}
                title="清空当前会话对话"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          }
        />
      </div>
    </div>
  );
}
