import {
  Bot,
  Check,
  CircleAlert,
  ExternalLink,
  Eye,
  FileText,
  Loader2,
  MousePointerClick,
  Navigation,
  Play,
  Square,
  UserRound,
  Wrench,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { type AIPlan, getPlan } from '@/lib/ai/plan';
import { redactSensitiveJsonObject } from '@/utils/sensitive';
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

const TOOL_LABELS: Record<string, string> = {
  browser_click: '点击页面元素',
  browser_close_tab: '关闭标签页',
  browser_done: '确认任务完成',
  browser_fill: '填写输入内容',
  browser_get_dropdown_options: '读取下拉选项',
  browser_go_back: '返回上一页',
  browser_go_forward: '前进到下一页',
  browser_navigate: '打开网页',
  browser_observe: '查看当前页面',
  browser_observe_visual: '查看页面截图',
  browser_open_tab: '打开新标签页',
  browser_refresh: '刷新页面',
  browser_request_user: '等待用户操作',
  browser_scroll: '滚动页面',
  browser_scroll_page: '翻页浏览',
  browser_scroll_to_bottom: '滚动到底部',
  browser_scroll_to_percent: '滚动到指定位置',
  browser_scroll_to_text: '查找并定位文本',
  browser_scroll_to_top: '滚动到顶部',
  browser_select: '选择下拉选项',
  browser_send_keys: '发送键盘操作',
  browser_switch_tab: '切换标签页',
  browser_wait: '等待页面变化',
  manage_plan: '更新任务计划',
};

const ARGUMENT_LABELS: Record<string, string> = {
  direction: '方向',
  index: '元素',
  keys: '按键',
  matchBy: '匹配方式',
  nth: '第几个',
  option: '选项',
  percent: '位置',
  reason: '原因',
  seconds: '等待时间',
  tabId: '标签页',
  text: '内容',
  url: '网址',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseToolContent(content: string): unknown {
  const taggedContent = content.match(
    /<dpp_untrusted_content[^>]*>\s*([\s\S]*?)\s*<\/dpp_untrusted_content>/
  );
  const candidate = taggedContent?.[1] || content.trim();
  try {
    return JSON.parse(candidate) as unknown;
  } catch {
    return null;
  }
}

function formatArgumentValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return '未提供';
  }
}

function formatJson(value: string): string {
  const redactedValue = redactSensitiveJsonObject(value);
  try {
    return JSON.stringify(JSON.parse(redactedValue) as unknown, null, 2);
  } catch {
    return redactedValue;
  }
}

function getActionDetails(name: string, args: string): string[] {
  const parsed = parseToolContent(args);
  if (!isRecord(parsed)) return [];

  return Object.entries(parsed)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${ARGUMENT_LABELS[key] || key}: ${formatArgumentValue(value)}`);
}

function getActionIcon(name: string) {
  if (name.includes('navigate') || name.includes('tab') || name.includes('refresh')) {
    return Navigation;
  }
  if (name.includes('observe')) return Eye;
  if (name.includes('click') || name.includes('fill') || name.includes('select')) {
    return MousePointerClick;
  }
  return Wrench;
}

function getToolResult(content: string): { message: string; url?: string; title?: string } {
  const parsed = parseToolContent(content);
  if (!isRecord(parsed)) return { message: content.replace(/<[^>]+>/g, '').trim() };

  const state = isRecord(parsed.state) ? parsed.state : undefined;
  const page = state && isRecord(state.page) ? state.page : undefined;
  const message = typeof parsed.message === 'string' ? parsed.message : '已完成这一步';
  return {
    message,
    url: page && typeof page.url === 'string' ? page.url : undefined,
    title: page && typeof page.title === 'string' ? page.title : undefined,
  };
}

function getUserMessageContent(content: string): string {
  const request = content.match(/<dpp_user_request>\s*([\s\S]*?)\s*<\/dpp_user_request>/);
  return request?.[1]?.trim() || content.trim();
}

function TechnicalDetails({ content }: { content: string }) {
  return (
    <details className="mt-2 rounded-md border border-border/50 bg-background/50 px-2 py-1.5">
      <summary className="cursor-pointer text-[11px] text-muted-foreground">
        查看工具原始响应
      </summary>
      <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-4 text-muted-foreground">
        {formatJson(content)}
      </pre>
    </details>
  );
}

function ToolCallDetails({
  toolCalls,
}: {
  toolCalls: NonNullable<BrowserTaskDetail['conversation'][number]['toolCalls']>;
}) {
  return (
    <details className="mt-2 rounded-md border border-warning/20 bg-warning/5 px-2 py-1.5">
      <summary className="cursor-pointer text-[11px] text-warning">
        查看工具调用 ({toolCalls.length})
      </summary>
      <div className="mt-2 grid gap-2">
        {toolCalls.map((toolCall) => (
          <div
            key={toolCall.id}
            className="min-w-0 rounded-md border border-border/50 bg-background/60 p-2"
          >
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 text-[11px]">
              <span className="font-semibold text-foreground">{toolCall.function.name}</span>
              <code className="break-all text-muted-foreground">{toolCall.id}</code>
            </div>
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-muted/60 p-2 font-mono text-[10px] leading-4 text-foreground [overflow-wrap:anywhere]">
              {formatJson(toolCall.function.arguments)}
            </pre>
          </div>
        ))}
      </div>
    </details>
  );
}

function BrowserTaskStep({
  message,
  index,
}: {
  message: BrowserTaskDetail['conversation'][number];
  index: number;
}) {
  const isToolResult = message.role === 'tool';
  const isUserMessage = message.role === 'user';
  const toolCall = message.toolCalls?.[0];
  const toolCalls = message.toolCalls || [];
  const toolName = toolCall?.function.name || message.name || '';
  const actionLabel = TOOL_LABELS[toolName] || getMessageLabel(message.role, message.name);
  const ActionIcon = isUserMessage ? UserRound : isToolResult ? Check : getActionIcon(toolName);
  const result = isToolResult ? getToolResult(message.content) : null;
  const actionDetails = toolCall ? getActionDetails(toolName, toolCall.function.arguments) : [];
  const content = message.content.trim();

  return (
    <div className="relative flex gap-3">
      <div className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-background">
        <ActionIcon className="h-3.5 w-3.5 text-info" />
      </div>
      <article className="min-w-0 flex-1 pb-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-xs font-semibold text-foreground">
            {isToolResult ? `${actionLabel}完成` : actionLabel}
          </span>
          <span className="shrink-0 text-[10px] text-muted-foreground">步骤 {index}</span>
        </div>

        {isUserMessage && (
          <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-muted-foreground">
            {getUserMessageContent(content) || '已接收任务'}
          </p>
        )}

        {!isToolResult && !isUserMessage && content && (
          <div className="mt-1 rounded-md border border-info/20 bg-info/5 px-2.5 py-2">
            {toolCalls.length > 0 && (
              <p className="mb-1 text-[11px] font-medium text-info">模型输出</p>
            )}
            <p className="whitespace-pre-wrap break-words text-xs leading-5 text-muted-foreground">
              {content}
            </p>
          </div>
        )}

        {actionDetails.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {actionDetails.map((detail) => (
              <span
                key={detail}
                className="max-w-full break-words rounded-md bg-muted/60 px-2 py-1 text-[11px] text-muted-foreground"
              >
                {detail}
              </span>
            ))}
          </div>
        )}

        {toolCalls.length > 0 && <ToolCallDetails toolCalls={toolCalls} />}

        {result && (
          <div className="mt-2 rounded-md border border-success/20 bg-success/5 px-2.5 py-2">
            <p className="text-xs leading-5 text-foreground">{result.message}</p>
            {(result.title || result.url) && (
              <p className="mt-1 flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground">
                <ExternalLink className="h-3 w-3 shrink-0" />
                <span className="truncate">{result.title || result.url}</span>
              </p>
            )}
          </div>
        )}

        {isToolResult && <TechnicalDetails content={message.content} />}
      </article>
    </div>
  );
}

function BrowserTaskDetailView({ detail }: { detail: BrowserTaskDetail }) {
  const messages = detail.conversation.filter((message) => message.role !== 'system');

  return (
    <div className="flex h-full min-h-0 min-w-0 w-full flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-contain pr-1 custom-scrollbar">
      <div className="relative min-w-0 w-full pl-1">
        <div className="absolute bottom-4 left-[14px] top-4 w-px bg-border/70" />
        {messages.map((message, index) => (
          <BrowserTaskStep
            key={`${detail.taskId}-message-${index}`}
            message={message}
            index={index + 1}
          />
        ))}

        {messages.length === 0 && (
          <div className="px-2 py-8 text-center text-xs text-muted-foreground">
            <FileText className="mx-auto mb-2 h-5 w-5 opacity-60" />子 Agent 正在准备任务
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
