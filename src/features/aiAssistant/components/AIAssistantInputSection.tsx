import { Eye, EyeOff, Scissors, Settings, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { YoloButton } from '@/components/YoloButton';
import { Button } from '@/components/ui/button';
import type { TokenUsage } from '@/lib/ai/types';
import { BROWSER_TASK_FOLLOW_STORAGE_KEY } from '@/lib/browserTask/types';
import { AIConfigDialog } from './AIConfigDialog';
import { AIUsageIndicator } from './AIUsageIndicator';
import { ChatInput } from './ChatInput';

interface AIAssistantInputSectionProps {
  isConfigMissing: boolean;
  isRunning: boolean;
  isConfirming: boolean;
  presetPrompt: string;
  usage?: TokenUsage;
  canClear: boolean;
  canSummarize: boolean;
  isSummarizing: boolean;
  onConfigSaved: () => void;
  onSend: (content: string) => Promise<void>;
  onStop: () => void;
  onSummarize: () => void;
  onClear: () => void;
}

export function AIAssistantInputSection({
  isConfigMissing,
  isRunning,
  isConfirming,
  presetPrompt,
  usage,
  canClear,
  canSummarize,
  isSummarizing,
  onConfigSaved,
  onSend,
  onStop,
  onSummarize,
  onClear,
}: AIAssistantInputSectionProps) {
  const disabled = isRunning || isConfirming;
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    void browser.storage.session
      .get(BROWSER_TASK_FOLLOW_STORAGE_KEY)
      .then((stored) => setIsFollowing(stored[BROWSER_TASK_FOLLOW_STORAGE_KEY] === true))
      .catch(() => undefined);
  }, []);

  const toggleFollowing = () => {
    const next = !isFollowing;
    setIsFollowing(next);
    void browser.storage.session.set({ [BROWSER_TASK_FOLLOW_STORAGE_KEY]: next });
  };

  return (
    <div className="border-t border-border/60 bg-background p-3 backdrop-blur">
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

      <div className="mb-2 flex items-center justify-between gap-2">
        <AIUsageIndicator usage={usage} />
        <div className="flex items-center gap-0.5 rounded-lg border border-border/50 bg-muted/25 p-0.5">
          <YoloButton disabled={isRunning} />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-md text-muted-foreground"
            onClick={toggleFollowing}
            aria-pressed={isFollowing}
            title={isFollowing ? '关闭跟随网页任务标签页' : '跟随网页任务当前标签页'}
          >
            {isFollowing ? <Eye className="h-4 w-4 text-info" /> : <EyeOff className="h-4 w-4" />}
          </Button>
          <AIConfigDialog onSaved={onConfigSaved}>
            <Button
              variant="ghost"
              size="icon"
              disabled={isRunning}
              className="h-8 w-8 rounded-md text-muted-foreground"
              title="AI 设置"
              data-testid="ai-config-button"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </AIConfigDialog>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-md text-muted-foreground"
            onClick={onSummarize}
            disabled={isRunning || !canSummarize || isSummarizing}
            title="压缩当前会话到新会话"
          >
            <Scissors className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-md text-muted-foreground"
            onClick={onClear}
            disabled={isRunning || !canClear}
            title="清空当前会话对话"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border/70 bg-muted/20 p-2 shadow-sm">
        <ChatInput
          onSend={onSend}
          onStop={onStop}
          disabled={disabled}
          isRunning={isRunning}
          placeholder="发送消息... (Shift+Enter 换行)"
          initialInput={presetPrompt}
        />
      </div>
    </div>
  );
}
