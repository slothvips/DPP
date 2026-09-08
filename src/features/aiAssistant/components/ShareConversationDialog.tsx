import { AlertTriangle, Check, Share2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { ChatMessage } from '../types';

interface ShareConversationDialogProps {
  open: boolean;
  sessionTitle: string;
  messages: ChatMessage[];
  onOpenChange: (open: boolean) => void;
  onShare: (input: { title: string; summary?: string }) => Promise<void>;
}

export function ShareConversationDialog({
  open,
  sessionTitle,
  messages,
  onOpenChange,
  onShare,
}: ShareConversationDialogProps) {
  const [title, setTitle] = useState(sessionTitle);
  const [summary, setSummary] = useState('');
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(sessionTitle);
    setSummary('');
  }, [open, sessionTitle]);

  const toolCallCount = messages.reduce(
    (count, message) => count + (message.toolCalls?.length ?? 0),
    0
  );
  const toolResultCount = messages.filter((message) => message.role === 'tool').length;
  const reasoningCount = messages.filter(
    (message) =>
      message.providerMetadata?.openAIReasoningContent ||
      (message.providerMetadata?.anthropicContentBlocks?.length ?? 0) > 0
  ).length;

  const handleShare = async () => {
    if (!title.trim() || sharing) return;
    setSharing(true);
    try {
      await onShare({ title: title.trim(), summary: summary.trim() || undefined });
      onOpenChange(false);
    } finally {
      setSharing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(88vh,680px)] w-[calc(100vw-2rem)] max-w-lg flex-col gap-4 overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" />
            永久分享会话
          </DialogTitle>
          <DialogDescription>
            分享后会保存为团队物料，任何成员都可以查看，且无法取消分享或删除。
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 space-y-4 overflow-y-auto py-1">
          <label className="grid gap-1.5 text-xs font-medium text-foreground">
            标题
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="为这次精彩会话命名"
              disabled={sharing}
              maxLength={200}
            />
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-foreground">
            摘要
            <Textarea
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              placeholder="补充这次会话的背景或适用场景（可选）"
              className="min-h-20 resize-y"
              disabled={sharing}
              maxLength={500}
            />
          </label>

          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <Stat label="消息" value={messages.length} />
            <Stat label="工具调用" value={toolCallCount} />
            <Stat label="工具结果" value={toolResultCount} />
            <Stat label="含思考" value={reasoningCount > 0 ? '是' : '否'} />
          </div>

          <div className="rounded-lg border border-warning/30 bg-warning/8 p-3 text-xs leading-5 text-foreground">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <p>
                将完整分享用户消息、思考过程、工具参数和工具返回结果。请确认内容中没有不应公开的密码、Token、Cookie
                或业务隐私。
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sharing}>
            先不分享
          </Button>
          <Button onClick={() => void handleShare()} disabled={sharing || !title.trim()}>
            <Check className="mr-1 h-4 w-4" />
            {sharing ? '分享中...' : '确认永久分享'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/25 px-2.5 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-semibold text-foreground">{value}</div>
    </div>
  );
}
