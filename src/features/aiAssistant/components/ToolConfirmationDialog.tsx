// Tool Confirmation Dialog - Shows when dangerous operations require confirmation
import { AlertTriangle, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { PendingToolCall, PendingToolCalls } from '../hooks/useAIChat';

interface ToolConfirmationDialogProps {
  pendingToolCall: PendingToolCall | null;
  pendingToolCalls: PendingToolCalls | null;
  onConfirm: () => void;
  onConfirmAll: () => void;
  onCancel: () => void;
}

/**
 * Get confirmation message based on the tool being called
 */
function getConfirmationContent(toolName: string, args: Record<string, unknown>) {
  switch (toolName) {
    case 'links_delete':
      return {
        title: '确认删除链接',
        description: '此操作将删除指定的链接，且无法恢复。',
        impact: `将删除链接 ID: ${args.id || '未知'}`,
        confirmText: '确认删除',
        isDestructive: true,
      };
    case 'blackboard_delete':
      return {
        title: '确认删除便签',
        description: '此操作将删除指定的便签，且无法恢复。',
        impact: `将删除便签 ID: ${args.id || '未知'}`,
        confirmText: '确认删除',
        isDestructive: true,
      };
    case 'tags_delete':
      return {
        title: '确认删除标签',
        description: '此操作将删除指定的标签及其所有关联关系，且无法恢复。',
        impact: `将删除标签 ID: ${args.id || '未知'}`,
        confirmText: '确认删除',
        isDestructive: true,
      };
    case 'jenkins_trigger_build':
      return {
        title: '确认触发构建',
        description: '此操作将触发 Jenkins 构建任务，可能需要一些时间完成。',
        impact: `将触发构建 job: ${args.job || '未知'}`,
        confirmText: '确认构建',
        isDestructive: false,
      };
    case 'recorder_start':
      return {
        title: '确认开始录制',
        description: '此操作将开始录屏，可能会占用系统资源。',
        impact: '将在当前标签页开始录制',
        confirmText: '开始录制',
        isDestructive: false,
      };
    default:
      return {
        title: '确认操作',
        description: '此操作需要您的确认才能继续执行。',
        impact: `将执行: ${toolName}`,
        confirmText: '确认',
        isDestructive: false,
      };
  }
}

export function ToolConfirmationDialog({
  pendingToolCall,
  pendingToolCalls,
  onConfirm,
  onConfirmAll,
  onCancel,
}: ToolConfirmationDialogProps) {
  // Use pendingToolCalls if available (multiple dangerous operations)
  const hasMultiple = !!pendingToolCalls && pendingToolCalls.toolCalls.length > 1;
  const isOpen = !!pendingToolCall || hasMultiple;

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onCancel();
    }
  };

  // If there are multiple pending tool calls
  if (hasMultiple) {
    const toolCallsList = pendingToolCalls.toolCalls;
    const argumentsList = pendingToolCalls.argumentsList;

    return (
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
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
              const content = getConfirmationContent(toolCall.function.name, args);
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
      </Dialog>
    );
  }

  // Single operation confirmation (original behavior)
  const toolName = pendingToolCall?.toolCall.function.name || '';
  const args = pendingToolCall?.arguments || {};
  const content = getConfirmationContent(toolName, args);

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md" data-testid="tool-confirmation-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle
              className={`w-5 h-5 ${content.isDestructive ? 'text-destructive' : 'text-yellow-500'}`}
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
              {JSON.stringify(args, null, 2)}
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
    </Dialog>
  );
}
