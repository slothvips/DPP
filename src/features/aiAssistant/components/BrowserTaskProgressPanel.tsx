import { Bot, Check, CircleAlert, Loader2, Play, Square } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { type AIPlan, getPlan } from '@/lib/ai/plan';
import type { BrowserTaskDetail, BrowserTaskProgress } from '../hooks/useBrowserTaskProgress';
import { getBrowserTaskDetail, resumeBrowserTask } from '../hooks/useBrowserTaskProgress';
import { AIPlanPanel } from './AIPlanPanel';

interface BrowserTaskProgressPanelProps {
  progress: BrowserTaskProgress[];
}

function getStatusText(status: BrowserTaskProgress['status']): string {
  if (status === 'completed') return '已完成';
  if (status === 'failed') return '执行失败';
  if (status === 'stopped') return '已停止';
  if (status === 'waiting_user') return '等待用户';
  if (status === 'queued') return '排队中';
  return '运行中';
}

function StatusIcon({ status }: { status: BrowserTaskProgress['status'] }) {
  if (status === 'completed') return <Check className="h-3.5 w-3.5 text-success" />;
  if (status === 'failed') return <CircleAlert className="h-3.5 w-3.5 text-destructive" />;
  if (status === 'stopped') return <Square className="h-3.5 w-3.5 text-muted-foreground" />;
  if (status === 'waiting_user') return <Play className="h-3.5 w-3.5 text-warning" />;
  return <Loader2 className="h-3.5 w-3.5 animate-spin text-info" />;
}

function getMessageLabel(role: string, name?: string): string {
  if (role === 'user') return '任务';
  if (role === 'tool') return name || '工具结果';
  return '子 Agent';
}

function BrowserTaskDetailView({ detail }: { detail: BrowserTaskDetail }) {
  const messages = detail.conversation.filter((message) => message.role !== 'system');

  return (
    <div className="flex h-full min-h-0 min-w-0 w-full flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-contain pr-1 custom-scrollbar">
      <div className="flex min-w-0 w-full flex-col gap-2">
        {messages.map((message, index) => (
          <article
            key={`${detail.taskId}-message-${index}`}
            className="min-w-0 w-full shrink-0 border-b border-border/45 pb-3 last:border-b-0"
          >
            <div className="mb-1 flex min-w-0 items-center gap-2 text-[11px] font-medium text-muted-foreground">
              <Bot className="h-3.5 w-3.5 text-info" />
              <span>{getMessageLabel(message.role, message.name)}</span>
              {message.toolCalls && message.toolCalls.length > 0 && (
                <span className="truncate font-normal">
                  {message.toolCalls.map((call) => call.function.name).join(', ')}
                </span>
              )}
            </div>
            <div className="min-w-0 w-full max-w-full overflow-x-hidden rounded-md bg-muted/20 px-2 py-1">
              <pre
                className="m-0 min-w-0 w-full font-sans text-xs leading-5 text-foreground"
                style={{
                  whiteSpace: 'pre-wrap',
                  overflowWrap: 'anywhere',
                  wordBreak: 'break-all',
                }}
              >
                {message.content || '无文本内容'}
              </pre>
            </div>
          </article>
        ))}

        {messages.length === 0 && (
          <div className="px-2 py-8 text-center text-xs text-muted-foreground">
            子 Agent 正在准备任务
          </div>
        )}
      </div>

      {detail.error && (
        <p className="mt-2 min-w-0 max-w-full break-all border-t border-destructive/20 pt-3 text-xs text-destructive">
          {detail.error}
        </p>
      )}
      {detail.result && (
        <p className="mt-2 min-w-0 max-w-full break-all border-t border-success/20 pt-3 text-xs text-success">
          {detail.result}
        </p>
      )}
      {detail.status === 'waiting_user' && (
        <button
          type="button"
          className="mt-2 flex items-center justify-center gap-1.5 rounded border border-warning/40 px-3 py-2 text-xs text-warning hover:bg-warning/10"
          onClick={() => void resumeBrowserTask(detail.taskId)}
        >
          <Play className="h-3.5 w-3.5" />
          我已完成接管，继续任务
        </button>
      )}
    </div>
  );
}

export function BrowserTaskProgressPanel({ progress }: BrowserTaskProgressPanelProps) {
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detail, setDetail] = useState<BrowserTaskDetail | null>(null);
  const [childPlan, setChildPlan] = useState<AIPlan | null>(null);
  const latestTask = [...progress].sort((left, right) => right.updatedAt - left.updatedAt)[0];
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(latestTask?.taskId || null);
  const selectedTask = progress.find((task) => task.taskId === selectedTaskId) || latestTask;
  const detailTaskId = selectedTask?.taskId;

  useEffect(() => {
    if (latestTask && !progress.some((task) => task.taskId === selectedTaskId)) {
      setSelectedTaskId(latestTask.taskId);
    }
  }, [latestTask, progress, selectedTaskId]);

  useEffect(() => {
    if (!isDetailOpen || !detailTaskId) return;
    let disposed = false;

    const loadDetail = async () => {
      const [nextDetail, nextPlan] = await Promise.all([
        getBrowserTaskDetail(detailTaskId),
        getPlan({ type: 'browser_task', id: detailTaskId }),
      ]);
      if (!disposed) {
        if (nextDetail) setDetail(nextDetail);
        setChildPlan(nextPlan || null);
      }
    };

    void loadDetail();
    const refreshTimer = window.setInterval(() => void loadDetail(), 1000);
    return () => {
      disposed = true;
      window.clearInterval(refreshTimer);
    };
  }, [detailTaskId, isDetailOpen]);

  if (!latestTask) return null;

  const handleOpenChange = (open: boolean) => {
    setIsDetailOpen(open);
    if (!open) {
      setDetail(null);
      setChildPlan(null);
    }
  };

  return (
    <>
      <div className="border-b border-info/25 border-t border-info/25 bg-info/5">
        <div className="px-2 py-2 text-[11px] font-semibold text-info">浏览器子任务</div>
        {progress.map((task) => (
          <button
            key={task.taskId}
            type="button"
            className="flex w-full items-center gap-2 border-t border-info/15 px-2 py-2.5 text-left hover:bg-info/10"
            onClick={() => {
              setSelectedTaskId(task.taskId);
              setIsDetailOpen(true);
            }}
            aria-label={`查看浏览器子 Agent 详情：${task.task}`}
          >
            <StatusIcon status={task.status} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs text-foreground">{task.task}</span>
              <span className="block truncate text-[11px] text-muted-foreground">
                浏览器 Agent · {getStatusText(task.status)}
              </span>
            </span>
            <span className="shrink-0 text-[11px] text-muted-foreground">详情</span>
          </button>
        ))}
      </div>

      <Dialog open={isDetailOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="grid h-[min(80vh,720px)] min-h-0 min-w-0 max-w-3xl grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden p-4 sm:p-6">
          <DialogHeader className="min-w-0 shrink-0 pr-6 text-left">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Bot className="h-4 w-4 text-info" />
              浏览器子 Agent
              <span className="ml-auto flex items-center gap-1 text-xs font-normal text-muted-foreground">
                <StatusIcon status={detail?.status || latestTask.status} />
                {getStatusText(detail?.status || latestTask.status)}
              </span>
            </DialogTitle>
            <DialogDescription className="truncate text-xs">{selectedTask?.task}</DialogDescription>
          </DialogHeader>

          {detail ? (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden">
              <AIPlanPanel plan={childPlan} title="子任务计划" />
              <BrowserTaskDetailView detail={detail} />
            </div>
          ) : (
            <div className="flex min-h-0 min-w-0 items-center justify-center text-xs text-muted-foreground">
              正在加载任务详情...
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
