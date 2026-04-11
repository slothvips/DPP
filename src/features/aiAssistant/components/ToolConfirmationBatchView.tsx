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
    <DialogContent className="max-w-md" data-testid="tool-confirmation-dialog">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-destructive" />
          确认批量操作
        </DialogTitle>
        <DialogDescription>
          即将执行 {toolCallsList.length} 个操作，这些操作需要您的确认
        </DialogDescription>
      </DialogHeader>

      <div className="py-2 max-h-60 overflow-y-auto">
        {toolCallsList.map((toolCall, index) => {
          const args = argumentsList[index] || {};
          const content = getToolConfirmationContent(toolCall.function.name, args);
          return (
            <div key={toolCall.id} className="mb-3 p-2 border rounded bg-muted/50 last:mb-0">
              <div className="font-medium text-sm">{content.title}</div>
              <div className="text-xs text-muted-foreground mt-1">{content.impact}</div>
            </div>
          );
        })}
      </div>

      <DialogFooter className="gap-2 sm:gap-0">
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
