import { ArrowDown, Bot, Sparkles } from 'lucide-react';
import { Fragment, type RefObject, type UIEventHandler } from 'react';
import { Button } from '@/components/ui/button';
import type { AIPlan } from '@/lib/ai/plan';
import type { OpenAIToolCall } from '@/lib/ai/types';
import type { AIChatStatus } from '../hooks/useAIChat.types';
import type { BrowserTaskProgress } from '../hooks/useBrowserTaskProgress';
import type { ChatMessage } from '../types';
import { AIConfigDialog } from './AIConfigDialog';
import { AIPlanPanel } from './AIPlanPanel';
import { BrowserTaskProgressPanel } from './BrowserTaskProgressPanel';
import { MessageItem } from './MessageItem';
import { RecentActions } from './RecentActions';

interface AIAssistantMessagesPanelProps {
  messages: ChatMessage[];
  status: AIChatStatus;
  error: string | null;
  isConfigMissing: boolean;
  isNearBottom: boolean;
  messagesContainerRef: RefObject<HTMLDivElement | null>;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  onScroll: UIEventHandler<HTMLDivElement>;
  onScrollToBottom: () => void;
  onConfigSaved: () => void;
  onEditMessage: (messageId: string, content: string) => Promise<void>;
  browserTaskProgress: BrowserTaskProgress[];
  plan: AIPlan | null;
  recentActions: import('@/db').RecentAction[];
  onReplayRecentAction: (action: import('@/db').RecentAction) => Promise<void>;
}

function readBrowserTaskArgument(argumentsJson: string): string | undefined {
  try {
    const args: unknown = JSON.parse(argumentsJson);
    if (typeof args !== 'object' || args === null || !('task' in args)) return undefined;
    return typeof args.task === 'string' ? args.task : undefined;
  } catch {
    return undefined;
  }
}

function isTaskForToolCall(task: BrowserTaskProgress, toolCall: OpenAIToolCall): boolean {
  if (!task.toolCallId) return false;
  return task.toolCallId === toolCall.id || task.toolCallId.startsWith(`${toolCall.id}:`);
}

function isBrowserTaskToolCall(toolCall: OpenAIToolCall): boolean {
  return (
    toolCall.function.name === 'delegate_browser_agent' ||
    toolCall.function.name === 'test_run_execute'
  );
}

function getAssistantProgressText(
  status: AIChatStatus,
  browserTaskProgress: BrowserTaskProgress[]
): string {
  const waitingTask = browserTaskProgress.find((task) => task.status === 'waiting_user');
  if (waitingTask) return '等待你完成网页操作';

  const runningTask = browserTaskProgress.find((task) => task.status === 'running');
  if (runningTask) return '正在执行网页任务';

  const queuedTask = browserTaskProgress.find((task) => task.status === 'queued');
  if (queuedTask) return '网页任务排队中';

  return status === 'streaming' ? '正在生成回答' : '正在处理请求';
}

function placeBrowserTasks(messages: ChatMessage[], progress: BrowserTaskProgress[]) {
  const anchoredTaskIds = new Set<string>();
  const tasksByMessageId = new Map<string, BrowserTaskProgress[]>();

  for (const message of messages) {
    for (const toolCall of message.toolCalls || []) {
      if (!isBrowserTaskToolCall(toolCall)) continue;

      const exactMatches = progress.filter(
        (task) => isTaskForToolCall(task, toolCall) && !anchoredTaskIds.has(task.taskId)
      );
      const taskArgument = readBrowserTaskArgument(toolCall.function.arguments);
      const matches =
        exactMatches.length > 0
          ? exactMatches
          : progress
              .filter(
                (task) =>
                  !task.toolCallId &&
                  !anchoredTaskIds.has(task.taskId) &&
                  taskArgument !== undefined &&
                  task.task === taskArgument
              )
              .slice(0, 1);

      if (matches.length === 0) continue;
      tasksByMessageId.set(message.id, [...(tasksByMessageId.get(message.id) || []), ...matches]);
      for (const task of matches) anchoredTaskIds.add(task.taskId);
    }
  }

  // Older records may not have a usable tool call ID. Keep them in the
  // conversation timeline when their creation time falls after a message.
  for (const task of progress) {
    if (task.toolCallId || anchoredTaskIds.has(task.taskId)) continue;

    const anchor = messages.reduce<ChatMessage | undefined>((latest, message) => {
      if (message.createdAt > task.createdAt) return latest;
      if (!latest || message.createdAt >= latest.createdAt) return message;
      return latest;
    }, undefined);
    if (!anchor) continue;

    tasksByMessageId.set(anchor.id, [...(tasksByMessageId.get(anchor.id) || []), task]);
    anchoredTaskIds.add(task.taskId);
  }

  return {
    tasksByMessageId,
    unanchoredTasks: progress.filter((task) => !anchoredTaskIds.has(task.taskId)),
  };
}

export function AIAssistantMessagesPanel({
  messages,
  status,
  error,
  isConfigMissing,
  isNearBottom,
  messagesContainerRef,
  messagesEndRef,
  onScroll,
  onScrollToBottom,
  onConfigSaved,
  onEditMessage,
  browserTaskProgress,
  plan,
  recentActions,
  onReplayRecentAction,
}: AIAssistantMessagesPanelProps) {
  const { tasksByMessageId, unanchoredTasks } = placeBrowserTasks(messages, browserTaskProgress);

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
      <AIPlanPanel plan={plan} defaultExpanded={true} />
      <div
        ref={messagesContainerRef}
        onScroll={onScroll}
        className="relative min-h-0 flex-1 overflow-y-auto bg-muted/15 px-3 py-3 custom-scrollbar sm:px-5 sm:py-4"
      >
        {isConfigMissing && messages.length === 0 && (
          <div className="flex h-full items-center justify-center px-4 py-8">
            <div className="w-full max-w-sm rounded-2xl border border-warning/25 bg-background p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warning/10 text-warning">
                  <Bot className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">先连接一个 AI 服务</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    配置完成后即可开始使用 D 仔。
                  </p>
                </div>
              </div>
              <AIConfigDialog onSaved={onConfigSaved}>
                <Button className="mt-4 rounded-lg px-4" size="sm">
                  去配置
                </Button>
              </AIConfigDialog>
            </div>
          </div>
        )}

        {!isConfigMissing && messages.length === 0 && (
          <div className="flex min-h-full items-center justify-center px-2 py-8">
            <div className="w-full max-w-xl text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                <Sparkles className="h-6 w-6" />
              </div>
              <p className="mt-4 text-lg font-semibold tracking-tight text-foreground">
                你好，我是 D 仔
              </p>
              <p className="mx-auto mt-2 max-w-md text-xs leading-6 text-muted-foreground">
                把目标告诉我，我可以帮你处理页面、链接、记录和工程任务。
              </p>
              <RecentActions actions={recentActions} onReplay={onReplayRecentAction} />
            </div>
          </div>
        )}

        <div className="mx-auto flex w-full max-w-3xl flex-col">
          {messages.map((message) => (
            <Fragment key={message.id}>
              <MessageItem
                message={message}
                canEdit={status !== 'loading' && status !== 'streaming' && status !== 'confirming'}
                onEditMessage={onEditMessage}
              />
              {(tasksByMessageId.get(message.id) || []).map((task) => (
                <BrowserTaskProgressPanel key={task.taskId} progress={[task]} />
              ))}
            </Fragment>
          ))}

          {(status === 'loading' || status === 'streaming') &&
            (!messages[messages.length - 1] ||
              messages[messages.length - 1].role !== 'assistant' ||
              messages[messages.length - 1].content.length === 0) && (
              <div className="flex items-center gap-3 border-b border-info/20 border-t border-info/20 bg-info/5 px-1 py-4 text-xs font-medium text-info sm:px-2">
                <span className="flex gap-1" aria-hidden="true">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-info [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-info [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-info" />
                </span>
                <span>{getAssistantProgressText(status, browserTaskProgress)}</span>
              </div>
            )}

          {unanchoredTasks.map((task) => (
            <BrowserTaskProgressPanel key={task.taskId} progress={[task]} />
          ))}

          {error && (
            <div className="border-b border-destructive/25 border-t border-destructive/25 bg-destructive/6 px-1 py-4 text-sm text-destructive sm:px-2">
              <span className="mr-2 font-semibold">出错</span>
              {error}
            </div>
          )}
        </div>

        <div ref={messagesEndRef} />
      </div>

      {!isNearBottom && (
        <button
          onClick={onScrollToBottom}
          className="absolute bottom-4 right-4 rounded-xl border border-border/70 bg-background/95 p-2 text-primary shadow-lg backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/18"
          title="直达底部"
        >
          <ArrowDown className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
