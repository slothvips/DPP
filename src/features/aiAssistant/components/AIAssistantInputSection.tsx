import { Button } from '@/components/ui/button';
import type { TokenUsage } from '@/lib/ai/types';
import { AIConfigDialog } from './AIConfigDialog';
import { AIUsageIndicator } from './AIUsageIndicator';
import { ChatInput } from './ChatInput';

interface AIAssistantInputSectionProps {
  isConfigMissing: boolean;
  isRunning: boolean;
  isConfirming: boolean;
  presetPrompt: string;
  usage?: TokenUsage;
  onConfigSaved: () => void;
  onSend: (content: string) => Promise<void>;
  onStop: () => void;
}

export function AIAssistantInputSection({
  isConfigMissing,
  isRunning,
  isConfirming,
  presetPrompt,
  usage,
  onConfigSaved,
  onSend,
  onStop,
}: AIAssistantInputSectionProps) {
  const disabled = isRunning || isConfirming;

  return (
    <div className="border-t border-border/60 bg-background/94 p-3 backdrop-blur">
      {isConfigMissing && (
        <div className="mb-3 rounded-2xl border border-warning/16 bg-warning/5 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-warning">未配置 AI 服务商，请先配置后才能对话</p>
            <AIConfigDialog onSaved={onConfigSaved}>
              <Button variant="ghost" size="sm" className="h-7 rounded-xl text-xs text-warning">
                去配置
              </Button>
            </AIConfigDialog>
          </div>
        </div>
      )}

      <AIUsageIndicator usage={usage} />

      <div className="rounded-2xl border border-border/60 bg-background/90 p-3">
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
