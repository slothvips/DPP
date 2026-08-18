import { Button } from '@/components/ui/button';
import type { TokenUsage } from '@/lib/ai/types';
import { AIConfigDialog } from './AIConfigDialog';
import { AIUsageIndicator } from './AIUsageIndicator';
import { ChatInput } from './ChatInput';
import { TabSelector } from './TabSelector';

interface AIAssistantInputSectionProps {
  isConfigMissing: boolean;
  isRunning: boolean;
  isConfirming: boolean;
  presetPrompt: string;
  selectedTabId: number | null;
  usage?: TokenUsage;
  onTabSelect: (tabId: number | null) => void;
  onConfigSaved: () => void;
  onSend: (content: string) => Promise<void>;
  onStop: () => void;
}

export function AIAssistantInputSection({
  isConfigMissing,
  isRunning,
  isConfirming,
  presetPrompt,
  selectedTabId,
  usage,
  onTabSelect,
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
          rightSlot={
            <div className="mb-2 flex flex-wrap items-center gap-2.5 rounded-xl bg-muted/45 px-3 py-2">
              <span className="text-xs font-medium text-foreground">目标页面</span>
              <TabSelector selectedTabId={selectedTabId} onTabSelect={onTabSelect} />
              <span
                className="cursor-help text-[10px] text-muted-foreground"
                title="执行期间请不要关闭任务相关标签页"
              >
                支持跨页面操作，执行期间请勿关闭任务标签页
              </span>
            </div>
          }
        />
      </div>
    </div>
  );
}
