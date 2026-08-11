import { AlertTriangle, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { PendingToolCalls } from '../hooks/useAIChat.types';
import { getToolConfirmationContent } from './toolConfirmationShared';

interface ToolConfirmationBatchViewProps {
  pendingToolCalls: PendingToolCalls;
  onConfirmAll: () => void;
  onCancel: () => void;
}

export function ToolConfirmationBatchView({
  pendingToolCalls,
  onConfirmAll,
  onCancel,
}: ToolConfirmationBatchViewProps) {
  const toolCallsList = pendingToolCalls.toolCalls;
  const argumentsList = pendingToolCalls.argumentsList;

  return (
    <DialogContent
      className="flex max-h-[min(80vh,calc(100dvh-2rem))] max-w-md flex-col gap-4 overflow-hidden"
      data-testid="tool-confirmation-dialog"
    >
      <DialogHeader className="shrink-0">
        <DialogTitle className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-destructive" />
          确认批量操作
        </DialogTitle>
        <DialogDescription>
          即将执行 {toolCallsList.length} 个操作，这些操作需要您的确认
        </DialogDescription>
      </DialogHeader>

      <div className="min-h-0 flex-1 overflow-y-auto py-2">
        {toolCallsList.map((toolCall, index) => {
          const args = argumentsList[index] || {};
          const content = getToolConfirmationContent(toolCall.function.name, args);
          return (
            <div key={toolCall.id} className="mb-3 rounded border bg-muted/50 p-2 last:mb-0">
              <div className="text-sm font-medium">{content.title}</div>
              <div className="mt-1 text-xs text-muted-foreground">{content.impact}</div>
            </div>
          );
        })}
      </div>

      <DialogFooter className="shrink-0 gap-2 sm:gap-0">
        <Button variant="outline" onClick={onCancel} data-testid="tool-confirmation-cancel">
          <X className="w-4 h-4 mr-1" />
          取消
        </Button>
        <Button
          variant="destructive"
          onClick={onConfirmAll}
          data-testid="tool-confirmation-confirm-all"
        >
          <Check className="w-4 h-4 mr-1" />
          确认全部 ({toolCallsList.length})
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
