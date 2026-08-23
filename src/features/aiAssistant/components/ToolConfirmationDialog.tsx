import { AlertTriangle, Check, X, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { redactSensitiveFields } from '@/utils/sensitive';
import type { PendingToolCall, PendingToolCalls } from '../hooks/useAIChat.types';
import { getToolConfirmationContent } from './toolConfirmationShared';

interface ToolConfirmationDialogProps {
  pendingToolCall: PendingToolCall | null;
  pendingToolCalls: PendingToolCalls | null;
  onConfirm: () => void;
  onConfirmAll: () => void;
  onCancel: () => void;
  onEnableYolo: () => void;
}

export function ToolConfirmationDialog({
  pendingToolCall,
  pendingToolCalls,
  onConfirm,
  onConfirmAll,
  onCancel,
  onEnableYolo,
}: ToolConfirmationDialogProps) {
  const hasMultiple = !!pendingToolCalls && pendingToolCalls.toolCalls.length > 1;
  const isOpen = !!pendingToolCall || hasMultiple;
  const toolName = pendingToolCall?.toolCall.function.name || '';
  const args = pendingToolCall?.arguments || {};
  const content = getToolConfirmationContent(toolName, args);
  const batchContents = pendingToolCalls?.toolCalls.map((toolCall, index) =>
    getToolConfirmationContent(toolCall.function.name, pendingToolCalls.argumentsList[index] || {})
  );
  const isDestructive = hasMultiple
    ? batchContents?.some((batchContent) => batchContent.isDestructive) === true
    : content.isDestructive;
  const safeArgs = redactSensitiveFields(args);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onCancel();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className="flex h-auto max-h-[min(80vh,calc(100dvh-2rem))] w-[calc(100vw-2rem)] max-w-md flex-col gap-4 overflow-hidden"
        data-testid="tool-confirmation-dialog"
      >
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle
              className={`h-5 w-5 shrink-0 ${isDestructive ? 'text-destructive' : 'text-warning'}`}
            />
            {hasMultiple ? '确认批量操作' : content.title}
          </DialogTitle>
          <DialogDescription>
            {hasMultiple
              ? `即将执行 ${pendingToolCalls?.toolCalls.length || 0} 个操作，这些操作需要您的确认`
              : content.description}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto py-2">
          {hasMultiple && pendingToolCalls ? (
            pendingToolCalls.toolCalls.map((toolCall, index) => {
              const batchContent = batchContents?.[index];
              return (
                <div key={toolCall.id} className="mb-3 rounded border bg-muted/50 p-2 last:mb-0">
                  <div className="text-sm font-medium">{batchContent?.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{batchContent?.impact}</div>
                </div>
              );
            })
          ) : (
            <>
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">操作影响:</span> {content.impact}
              </div>
              {Object.keys(args).length > 0 && (
                <div className="mt-2 rounded bg-muted p-2 font-mono text-xs text-muted-foreground">
                  <div className="mb-1 font-medium">参数:</div>
                  <pre className="whitespace-pre-wrap break-all">
                    {JSON.stringify(safeArgs, null, 2)}
                  </pre>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="shrink-0 gap-2 sm:gap-0">
          <Button variant="outline" onClick={onCancel} data-testid="tool-confirmation-cancel">
            <X className="mr-1 h-4 w-4" />
            取消
          </Button>
          <Button
            variant={isDestructive ? 'destructive' : 'default'}
            onClick={hasMultiple ? onConfirmAll : onConfirm}
            data-testid={
              hasMultiple ? 'tool-confirmation-confirm-all' : 'tool-confirmation-confirm'
            }
          >
            <Check className="mr-1 h-4 w-4" />
            {hasMultiple
              ? `确认全部 (${pendingToolCalls?.toolCalls.length || 0})`
              : content.confirmText}
          </Button>
        </DialogFooter>

        <div className="shrink-0 border-t border-border/60 pt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onEnableYolo}
            data-testid="tool-confirmation-yolo"
            title="开启 YOLO 并继续执行"
            className="yolo-button-active h-8 w-full gap-1 border border-border px-2 text-xs transition-all duration-300"
          >
            <Zap className="h-3.5 w-3.5 fill-primary text-primary" />
            <span className="font-medium text-primary">聒噪,YOLO!</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
