import {
  Bot,
  Check,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Loader2,
  Play,
  Square,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { redactSensitiveJsonObject } from '@/utils/sensitive';
import type { BrowserTaskDetail, BrowserTaskProgress } from '../hooks/useBrowserTaskProgress';
import { getBrowserTaskDetail, resumeBrowserTask } from '../hooks/useBrowserTaskProgress';

interface BrowserTaskProgressPanelProps {
  progress: BrowserTaskProgress[];
}

function getStatusText(status: BrowserTaskProgress['status']): string {
  if (status === 'completed') return '已完成';
  if (status === 'failed') return '执行失败';
  if (status === 'stopped') return '已停止';
  if (status === 'waiting_user') return '需要你操作';
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

const TOOL_LABELS: Record<string, string> = {
  click_element: '点击页面元素',
  input_text: '填写输入内容',
  select_option: '选择下拉选项',
  scroll: '滚动页面',
  scroll_horizontally: '横向滚动页面',
  open_new_tab: '打开新标签页',
  switch_to_tab: '切换标签页',
  close_tab: '关闭标签页',
  browser_request_user: '等待用户操作',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getReadableText(value: unknown, fallback: string): string {
  if (typeof value === 'string') return value.trim() || fallback;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    const text = value
      .map((item) => getReadableText(item, ''))
      .filter(Boolean)
      .join('、');
    return text || fallback;
  }
  if (isRecord(value)) {
    for (const key of ['message', 'text', 'summary', 'description', 'reason', 'output']) {
      const text = getReadableText(value[key], '');
      if (text) return text;
    }
  }
  return fallback;
}

function getRawHistoryText(value: unknown): string {
  const serialized = JSON.stringify(value);
  if (!serialized) return '无法显示原始记录';
  try {
    const redacted = redactSensitiveJsonObject(serialized);
    return JSON.stringify(JSON.parse(redacted) as unknown, null, 2);
  } catch {
    return '无法显示原始记录';
  }
}

function getHistoryLabel(type: string, actionName?: string): string {
  if (actionName) return TOOL_LABELS[actionName] || actionName;
  if (type === 'reflection') return 'Agent 判断';
  if (type === 'action') return '页面操作';
  if (type === 'result') return '执行结果';
  return '执行记录';
}

function getWaitingInstruction(reason: BrowserTaskDetail['waitingReason']): string {
  return reason === 'retry'
    ? '请先检查目标网页并完成必要操作，再重试当前步骤。'
    : '请先在目标网页完成手动输入或验证，再继续测试。';
}

function getWaitingActionLabel(reason: BrowserTaskDetail['waitingReason']): string {
  return reason === 'retry' ? '我已处理页面，重试当前步骤' : '我已完成手动输入，继续测试';
}

function PageAgentHistory({ history }: { history: unknown[] }) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const shouldFollowRef = useRef(true);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container && shouldFollowRef.current) container.scrollTop = container.scrollHeight;
  }, [history.length]);

  return (
    <section className="min-h-0 border-b border-border/60 pb-2">
      <div className="mb-2 flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
        <span>执行轨迹</span>
        <span>{history.length} 条记录</span>
      </div>
      <div
        ref={scrollContainerRef}
        className="max-h-64 space-y-0 overflow-y-auto pr-1 custom-scrollbar"
        onWheel={(event) => {
          if (event.deltaY < 0) shouldFollowRef.current = false;
        }}
        onScroll={(event) => {
          const container = event.currentTarget;
          shouldFollowRef.current =
            container.scrollHeight - container.scrollTop - container.clientHeight <= 4;
        }}
      >
        {history.map((event, index) => {
          const record = isRecord(event) ? event : {};
          const type = typeof record.type === 'string' ? record.type : 'event';
          const action = isRecord(record.action) ? record.action : undefined;
          const actionName = action && typeof action.name === 'string' ? action.name : undefined;
          const reflection = isRecord(record.reflection) ? record.reflection : undefined;
          const output = action && typeof action.output === 'string' ? action.output : undefined;
          return (
            <div key={`history-${index}`} className="relative flex gap-2.5 pb-3 last:pb-0">
              {index < history.length - 1 && (
                <span className="absolute bottom-0 left-[9px] top-5 w-px bg-border/70" />
              )}
              <span className="relative z-10 mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border border-info/30 bg-background text-info">
                <Check className="h-3 w-3" />
              </span>
              <div className="min-w-0 flex-1 rounded-md border border-border/50 bg-muted/20 px-2.5 py-2">
                <p className="text-[11px] font-medium text-foreground">
                  {getHistoryLabel(type, actionName)}
                </p>
                {reflection && actionName !== 'done' && (
                  <div className="mt-1 space-y-1 whitespace-pre-wrap break-words text-[11px] leading-4 text-muted-foreground">
                    <p>
                      <span className="font-medium text-foreground">上一步评估：</span>
                      {getReadableText(reflection.evaluation_previous_goal, '暂无')}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">记忆：</span>
                      {getReadableText(reflection.memory, '暂无')}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">下一步目标：</span>
                      {getReadableText(reflection.next_goal, '暂无')}
                    </p>
                  </div>
                )}
                {output && (
                  <p className="mt-1 whitespace-pre-wrap break-words text-[11px] leading-4 text-muted-foreground">
                    <span className="font-medium text-foreground">执行结果：</span>
                    {getReadableText(output, '页面操作已完成')}
                  </p>
                )}
                {!reflection && !output && (
                  <p className="mt-1 text-[11px] leading-4 text-muted-foreground">页面状态已更新</p>
                )}
                <details className="mt-2">
                  <summary className="cursor-pointer text-[10px] text-muted-foreground/80">
                    查看原始 JSON
                  </summary>
                  <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-background/70 p-1.5 font-mono text-[10px] leading-4 text-muted-foreground">
                    {getRawHistoryText(event)}
                  </pre>
                </details>
              </div>
            </div>
          );
        })}
        {history.length === 0 && (
          <p className="rounded-md border border-dashed border-border/70 px-2.5 py-3 text-center text-[11px] text-muted-foreground">
            Agent 正在准备页面操作
          </p>
        )}
      </div>
    </section>
  );
}

function BrowserTaskDetailView({
  detail,
  onResume,
  resumeError,
}: {
  detail: BrowserTaskDetail;
  onResume: () => void;
  resumeError: string | null;
}) {
  return (
    <div className="min-w-0">
      {detail.activity !== undefined && detail.activity !== null && (
        <p className="mb-2 rounded-md border border-info/20 bg-info/5 px-2.5 py-2 text-[11px] text-info">
          当前：{getReadableText(detail.activity, '正在执行页面操作')}
        </p>
      )}
      <PageAgentHistory history={detail.history} />

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
          onClick={onResume}
        >
          <Play className="h-3.5 w-3.5" />
          {getWaitingActionLabel(detail.waitingReason)}
        </button>
      )}
      {resumeError && <p className="mt-2 text-xs text-destructive">{resumeError}</p>}
    </div>
  );
}

export function BrowserTaskProgressPanel({ progress }: BrowserTaskProgressPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [detail, setDetail] = useState<BrowserTaskDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const latestTask = [...progress].sort((left, right) => right.updatedAt - left.updatedAt)[0];
  const detailTaskId = latestTask?.taskId;
  const detailSessionId = latestTask?.sessionId;

  useEffect(() => {
    if (!detailTaskId) return;
    let disposed = false;

    const loadDetail = async () => {
      try {
        const nextDetail = await getBrowserTaskDetail(detailTaskId, detailSessionId);
        if (!disposed) {
          if (nextDetail) {
            setDetail(nextDetail);
            setDetailError(null);
          } else {
            setDetailError('任务详情不可用，可能已被清理或后台已重启');
          }
        }
      } catch (error) {
        if (!disposed) {
          setDetailError(error instanceof Error ? error.message : '任务详情加载失败');
        }
      }
    };

    void loadDetail();
    const refreshTimer = window.setInterval(() => void loadDetail(), 1000);
    return () => {
      disposed = true;
      window.clearInterval(refreshTimer);
    };
  }, [detailSessionId, detailTaskId]);

  useEffect(() => {
    const status = detail?.status || latestTask?.status;
    if (status === 'waiting_user') setIsExpanded(true);
  }, [detail?.status, latestTask?.status]);

  if (!latestTask) return null;
  const displayedStatus = detail?.status || latestTask.status;
  const displayedWaitingReason = detail?.waitingReason || latestTask.waitingReason;
  const handleResume = () => {
    setResumeError(null);
    void resumeBrowserTask(latestTask.taskId, latestTask.sessionId).then((success) => {
      setResumeError(success ? null : '任务恢复失败，请重新打开任务或检查后台状态');
    });
  };

  return (
    <section className="my-2 min-w-0 rounded-md border border-info/25 bg-info/5">
      <div className="flex min-w-0 items-center">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 px-3 py-1.5 text-left hover:bg-info/5"
          onClick={() => setIsExpanded((expanded) => !expanded)}
          aria-label={isExpanded ? '收起子任务' : '展开子任务'}
        >
          <StatusIcon status={displayedStatus} />
          <span className="min-w-0 flex-1 truncate text-[11px] text-foreground">
            {latestTask.task}
          </span>
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {getStatusText(displayedStatus)}
          </span>
          {isExpanded ? (
            <ChevronUp className="h-3 w-3 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
          )}
        </button>
      </div>
      {!isExpanded && displayedStatus === 'waiting_user' && (
        <div className="flex flex-wrap items-center gap-2 border-t border-warning/20 px-3 py-2">
          <p className="min-w-0 flex-1 text-[11px] leading-4 text-warning">
            {getWaitingInstruction(displayedWaitingReason)}
          </p>
          <button
            type="button"
            className="flex min-h-7 shrink-0 items-center gap-1 rounded border border-warning/40 px-2 py-1 text-[11px] text-warning hover:bg-warning/10"
            onClick={handleResume}
            aria-label={getWaitingActionLabel(displayedWaitingReason)}
            title={getWaitingActionLabel(displayedWaitingReason)}
          >
            <Play className="h-3.5 w-3.5" />
            {displayedWaitingReason === 'retry' ? '处理完成，重试' : '输入完成，继续'}
          </button>
        </div>
      )}
      {resumeError && !isExpanded && (
        <p className="border-t border-destructive/20 px-3 py-2 text-xs text-destructive">
          {resumeError}
        </p>
      )}
      {isExpanded && (
        <div className="border-t border-info/15 px-3 pb-2.5 pt-2.5">
          <div className="mb-2.5 flex items-start gap-2">
            <Bot className="mt-0.5 h-3.5 w-3.5 shrink-0 text-info" />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-info">
                本次目标
              </p>
              <p className="mt-0.5 whitespace-pre-wrap break-words text-xs leading-5 text-foreground">
                {latestTask.task}
              </p>
            </div>
          </div>
          {detail ? (
            <BrowserTaskDetailView
              detail={detail}
              resumeError={resumeError}
              onResume={handleResume}
            />
          ) : (
            <p className="text-xs text-muted-foreground">{detailError || '正在准备执行轨迹...'}</p>
          )}
          {detailError && detail && <p className="mt-2 text-xs text-destructive">{detailError}</p>}
        </div>
      )}
    </section>
  );
}
