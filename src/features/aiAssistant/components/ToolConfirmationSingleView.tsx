import { AlertTriangle, Check, X } from 'lucide-react';
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
}

export function ToolConfirmationSingleView({
  pendingToolCall,
  onConfirm,
  onCancel,
}: ToolConfirmationSingleViewProps) {
  const toolName = pendingToolCall?.toolCall.function.name || '';
  const args = pendingToolCall?.arguments || {};
  const safeArgs = redactSensitiveFields(args);
  const content = getToolConfirmationContent(toolName, args);

  return (
    <DialogContent className="max-w-md" data-testid="tool-confirmation-dialog">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <AlertTriangle
            className={`w-5 h-5 ${content.isDestructive ? 'text-destructive' : 'text-warning'}`}
          />
          {content.title}
        </DialogTitle>
        <DialogDescription>{content.description}</DialogDescription>
      </DialogHeader>

      <div className="py-2">
        <div className="text-sm text-muted-foreground">
          <span className="font-medium">操作影响:</span> {content.impact}
        </div>
        {Object.keys(args).length > 0 && (
          <div className="mt-2 text-xs text-muted-foreground font-mono bg-muted p-2 rounded">
            <div className="font-medium mb-1">参数:</div>
            {JSON.stringify(safeArgs, null, 2)}
          </div>
        )}
      </div>

      <DialogFooter className="gap-2 sm:gap-0">
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
    </DialogContent>
  );
}
