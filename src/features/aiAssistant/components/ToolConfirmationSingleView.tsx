import { AlertTriangle, Check, X, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { redactSensitiveFields } from '@/utils/sensitive';
import type { PendingToolCall } from '../hooks/useAIChat.types';
import { getToolConfirmationContent } from './toolConfirmationShared';

interface ToolConfirmationSingleViewProps {
  pendingToolCall: PendingToolCall | null;
  onConfirm: () => void;
  onCancel: () => void;
  onEnableYolo: () => void;
}

export function ToolConfirmationSingleView({
  pendingToolCall,
  onConfirm,
  onCancel,
  onEnableYolo,
}: ToolConfirmationSingleViewProps) {
  const toolName = pendingToolCall?.toolCall.function.name || '';
  const args = pendingToolCall?.arguments || {};
  const safeArgs = redactSensitiveFields(args);
  const content = getToolConfirmationContent(toolName, args);

  return (
    <DialogContent
      className="flex max-h-[min(80vh,calc(100dvh-2rem))] max-w-md flex-col gap-4 overflow-hidden"
      data-testid="tool-confirmation-dialog"
    >
      <DialogHeader className="shrink-0">
        <DialogTitle className="flex items-center gap-2">
          <AlertTriangle
            className={`w-5 h-5 ${content.isDestructive ? 'text-destructive' : 'text-warning'}`}
          />
          {content.title}
        </DialogTitle>
        <DialogDescription>{content.description}</DialogDescription>
      </DialogHeader>

      <div className="min-h-0 flex-1 overflow-y-auto py-2">
        <div className="text-sm text-muted-foreground">
          <span className="font-medium">操作影响:</span> {content.impact}
        </div>
        {Object.keys(args).length > 0 && (
          <div className="mt-2 rounded bg-muted p-2 font-mono text-xs text-muted-foreground">
            <div className="mb-1 font-medium">参数:</div>
            <pre className="whitespace-pre-wrap break-all">{JSON.stringify(safeArgs, null, 2)}</pre>
          </div>
        )}
      </div>

      <DialogFooter className="shrink-0 gap-2 sm:gap-0">
        <Button variant="outline" onClick={onCancel} data-testid="tool-confirmation-cancel">
          <X className="w-4 h-4 mr-1" />
          取消
        </Button>
        <Button
          variant={content.isDestructive ? 'destructive' : 'default'}
          onClick={onConfirm}
          data-testid="tool-confirmation-confirm"
        >
          <Check className="w-4 h-4 mr-1" />
          {content.confirmText}
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
  );
}
