import {
  Check,
  ChevronDown,
  CircleAlert,
  Loader2,
  MessageSquareText,
  Pause,
  Play,
  RotateCcw,
  Square,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { stopActiveBrowserTask } from '@/lib/ai/tools/browserTask';
import { cn } from '@/utils/cn';
import type { BrowserTaskProgress } from '../hooks/useBrowserTaskProgress';

interface BrowserTaskProgressPanelProps {
  progress: BrowserTaskProgress;
}

function getValueText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.length > 0 ? `${value.length} 项操作` : '暂无详情';
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    for (const key of [
      'message',
      'description',
      'result',
      'action',
      'name',
      'type',
      'text',
      'url',
    ]) {
      if (typeof record[key] === 'string' && record[key]) return record[key];
    }
    try {
      return JSON.stringify(record);
    } catch {
      return '执行网页操作';
    }
  }
  return '执行网页操作';
}

function getStatusText(status: BrowserTaskProgress['status']): string {
  if (status === 'completed') return '已完成';
  if (status === 'failed') return '执行失败';
  if (status === 'stopped') return '已停止';
  if (status === 'waiting_user') return '等待你操作';
  return '执行中';
}

async function resolveRetryTabId(initialTabId?: number): Promise<number | null> {
  if (initialTabId !== undefined) {
    try {
      const tab = await browser.tabs.get(initialTabId);
      if (tab.url?.startsWith('http')) return initialTabId;
    } catch {
      // 原标签页已关闭，改用当前活动标签页
    }
  }
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab?.id !== undefined && tab.url?.startsWith('http') ? tab.id : null;
}

async function retryTask(progress: BrowserTaskProgress): Promise<void> {
  const tabId = await resolveRetryTabId(progress.initialTabId);
  if (tabId === null) return;
  await browser.runtime.sendMessage({
    type: 'BROWSER_TASK_START',
    taskId: crypto.randomUUID(),
    task: progress.task,
    sessionId: progress.sessionId,
    initialTabId: tabId,
    resumeTaskId: progress.taskId,
  });
}

export function BrowserTaskProgressPanel({ progress }: BrowserTaskProgressPanelProps) {
  const isTerminal =
    progress.status === 'completed' ||
    progress.status === 'failed' ||
    progress.status === 'stopped';
  const [isExpanded, setIsExpanded] = useState(!isTerminal);
  const [retryError, setRetryError] = useState<string | null>(null);
  useEffect(() => {
    if (isTerminal) setIsExpanded(false);
  }, [isTerminal]);

  const isFailed = progress.status === 'failed';
  const isStopped = progress.status === 'stopped';
  const isWaitingForUser = progress.status === 'waiting_user';
  const isCompleted = progress.status === 'completed';
  const steps = progress.history.slice(-6);
  const currentText = progress.activity ? getValueText(progress.activity) : '正在准备下一步操作';

  return (
    <div
      className="rounded-2xl border border-info/25 bg-info/6 px-3.5 py-3"
      aria-live="polite"
      role="status"
    >
      <div className="flex items-center gap-2 text-left">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          onClick={() => setIsExpanded((expanded) => !expanded)}
          aria-expanded={isExpanded}
        >
          {isFailed ? (
            <CircleAlert className="h-3.5 w-3.5 shrink-0 text-destructive" />
          ) : isCompleted ? (
            <Check className="h-3.5 w-3.5 shrink-0 text-success" />
          ) : isWaitingForUser ? (
            <Pause className="h-3.5 w-3.5 shrink-0 text-warning" />
          ) : isStopped ? (
            <Square className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-info" />
          )}
          <span className="min-w-0 flex-1 whitespace-normal break-words text-xs font-medium leading-5 text-foreground">
            网页子任务 · {getStatusText(progress.status)} · {progress.task}
          </span>
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {progress.history.length} 步
          </span>
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 text-muted-foreground transition-transform',
              isExpanded && 'rotate-180'
            )}
          />
        </button>
        {!isTerminal && !isWaitingForUser && (
          <button
            type="button"
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-foreground hover:bg-muted"
            title="停止当前网页任务"
            onClick={() => void stopActiveBrowserTask()}
          >
            <Square className="h-2.5 w-2.5 fill-current" />
            停止
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="mt-2 max-h-56 overflow-y-auto border-t border-border/50 pt-2.5 custom-scrollbar">
          {!isTerminal && !isWaitingForUser && (
            <div className="flex items-center gap-2 text-[11px] text-info">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-info/10">
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
              </span>
              <span className="whitespace-normal break-words leading-5">{currentText}</span>
            </div>
          )}

          {progress.modelOutput && (
            <div className="flex items-start gap-2 text-[11px] text-foreground">
              <MessageSquareText className="mt-1 h-3.5 w-3.5 shrink-0 text-primary" />
              <p className="whitespace-pre-wrap break-words leading-5">{progress.modelOutput}</p>
            </div>
          )}

          {isWaitingForUser && (
            <div className="flex items-center justify-between gap-2 text-[11px] text-warning">
              <span className="whitespace-normal break-words leading-5">
                {getValueText(progress.activity) || '请在当前页面完成操作'}
              </span>
              <button
                type="button"
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-warning/30 px-2 py-1 text-warning hover:bg-warning/10"
                onClick={() =>
                  void browser.runtime.sendMessage({
                    type: 'BROWSER_TASK_RESUME',
                    taskId: progress.taskId,
                  })
                }
              >
                <Play className="h-3 w-3" />
                继续
              </button>
            </div>
          )}

          {steps.length > 0 && (
            <ol className={cn('space-y-1.5', !isTerminal && 'mt-2 border-l border-border/60 pl-3')}>
              {steps.map((step, index) => (
                <li
                  key={`${progress.taskId}-${progress.history.length - steps.length + index}`}
                  className="flex min-w-0 items-center gap-2 text-[11px] text-muted-foreground"
                >
                  <Check className="h-3 w-3 shrink-0 text-success" />
                  <span className="whitespace-normal break-words leading-5">
                    {getValueText(step)}
                  </span>
                </li>
              ))}
            </ol>
          )}

          {progress.error && (
            <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-5 text-destructive">
              <Square className="mt-1 h-2.5 w-2.5 shrink-0 fill-current" />
              <span>{progress.error}</span>
            </p>
          )}

          {progress.result && (
            <p className="mt-2 whitespace-pre-wrap break-words border-t border-border/50 pt-2 text-[11px] leading-5 text-success">
              {progress.result}
            </p>
          )}
        </div>
      )}

      {(isFailed || isStopped) && (
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-border/50 pt-2.5">
          <span className="min-w-0 flex-1 truncate text-[11px] leading-5 text-muted-foreground">
            {progress.error || '任务未完成'}
          </span>
          <button
            type="button"
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-foreground hover:bg-muted"
            title="带上次执行记录重新开始，从断点继续"
            onClick={() => {
              setRetryError(null);
              void retryTask(progress)
                .then((response: unknown) => {
                  if (
                    typeof response === 'object' &&
                    response !== null &&
                    'success' in response &&
                    response.success === false
                  ) {
                    setRetryError('旧任务尚未清理完成，请稍后重试');
                  }
                })
                .catch((error: unknown) => {
                  setRetryError(error instanceof Error ? error.message : '任务启动失败');
                });
            }}
          >
            <RotateCcw className="h-3 w-3" />
            重试并继续
          </button>
          {retryError && <span className="text-[11px] text-destructive">{retryError}</span>}
        </div>
      )}
    </div>
  );
}
