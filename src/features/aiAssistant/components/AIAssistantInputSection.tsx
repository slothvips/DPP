import { Button } from '@/components/ui/button';
import { AIConfigDialog } from './AIConfigDialog';
import { ChatInput } from './ChatInput';
import { TabSelector } from './TabSelector';

interface AIAssistantInputSectionProps {
  isConfigMissing: boolean;
  isRunning: boolean;
  isConfirming: boolean;
  presetPrompt: string;
  selectedTabId: number | null;
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
  onTabSelect,
  onConfigSaved,
  onSend,
  onStop,
}: AIAssistantInputSectionProps) {
  const disabled = isRunning || isConfirming;

  return (
    <div className="border-t p-3">
      {isConfigMissing && (
        <div className="mb-2 p-2 bg-warning/10 dark:bg-warning/20 border border-warning/30 rounded-md">
          <div className="flex items-center justify-between">
            <p className="text-xs text-warning">未配置 AI 服务商，请先配置后才能对话</p>
            <AIConfigDialog onSaved={onConfigSaved}>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-warning hover:text-warning/80"
              >
                去配置
              </Button>
            </AIConfigDialog>
          </div>
        </div>
      )}

      <ChatInput
        onSend={onSend}
        onStop={onStop}
        disabled={disabled}
        isRunning={isRunning}
        placeholder="发送消息... (Shift+Enter 换行)"
        initialInput={presetPrompt}
        rightSlot={
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">目标页面:</span>
            <TabSelector selectedTabId={selectedTabId} onTabSelect={onTabSelect} />
            <span
              className="text-[10px] text-orange-500 italic cursor-help"
              title="执行期间请保持页面在前台，不要切换或关闭标签页"
            >
              (仅支持SPA，请保持页面始终处于前台)
            </span>
          </div>
        }
      />
    </div>
  );
}
