// Tool Confirmation Dialog - Shows when dangerous operations require confirmation
import { Dialog } from '@/components/ui/dialog';
import type { PendingToolCall, PendingToolCalls } from '../hooks/useAIChat.types';
import { ToolConfirmationBatchView } from './ToolConfirmationBatchView';
import { ToolConfirmationSingleView } from './ToolConfirmationSingleView';

interface ToolConfirmationDialogProps {
  pendingToolCall: PendingToolCall | null;
  pendingToolCalls: PendingToolCalls | null;
  onConfirm: () => void;
  onConfirmAll: () => void;
  onCancel: () => void;
}

export function ToolConfirmationDialog({
  pendingToolCall,
  pendingToolCalls,
  onConfirm,
  onConfirmAll,
  onCancel,
}: ToolConfirmationDialogProps) {
  const hasMultiple = !!pendingToolCalls && pendingToolCalls.toolCalls.length > 1;
  const isOpen = !!pendingToolCall || hasMultiple;

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onCancel();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      {hasMultiple && pendingToolCalls ? (
        <ToolConfirmationBatchView
          pendingToolCalls={pendingToolCalls}
          onConfirmAll={onConfirmAll}
          onCancel={onCancel}
        />
      ) : (
        <ToolConfirmationSingleView
          pendingToolCall={pendingToolCall}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      )}
    </Dialog>
  );
}
