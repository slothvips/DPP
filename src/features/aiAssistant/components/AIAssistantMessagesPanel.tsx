import { ArrowDown, Bot, Sparkles } from 'lucide-react';
import type { RefObject, UIEventHandler } from 'react';
import { Button } from '@/components/ui/button';
import type { AIChatStatus } from '../hooks/useAIChat.types';
import type { BrowserTaskProgress } from '../hooks/useBrowserTaskProgress';
import type { ChatMessage } from '../types';
import { AIConfigDialog } from './AIConfigDialog';
import { BrowserTaskProgressPanel } from './BrowserTaskProgressPanel';
import { MessageItem } from './MessageItem';

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
  browserTaskProgress: BrowserTaskProgress | null;
}

const CAPABILITY_GROUPS = [
  {
    title: '页面与浏览器',
    items: ['总结页面内容', '提取结构化信息', '翻译页面内容', '打开链接', '执行页面操作'],
  },
  {
    title: '链接与标签',
    items: ['查询链接', '新增或批量导入链接', '更新或删除链接', '创建和整理标签', '给链接打标签'],
  },
  {
    title: '便笺与记录',
    items: ['查看便笺', '新增或修改便笺', '置顶或锁定便笺', '查看最近操作记录'],
  },
  {
    title: 'Jenkins',
    items: ['查找 Job', '查看构建历史', '切换环境', '同步 Jenkins 数据', '发起构建'],
  },
  {
    title: '录制与数据',
    items: ['开始或停止录制', '重命名录像', '导入或导出录像', '删除录像', '触发同步'],
  },
  {
    title: '资讯辅助',
    items: ['查看今日热榜缓存', '结合本地数据回答问题', '按目标串联多步操作'],
  },
] as const;

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
}: AIAssistantMessagesPanelProps) {
  return (
    <div className="relative min-h-0 flex-1 overflow-hidden bg-background">
      <div
        ref={messagesContainerRef}
        onScroll={onScroll}
        className="absolute inset-0 overflow-y-auto bg-muted/15 px-3 py-5 custom-scrollbar sm:px-5"
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

              <div className="mt-6 grid gap-2 text-left sm:grid-cols-2">
                {CAPABILITY_GROUPS.map((group) => (
                  <div
                    key={group.title}
                    className="rounded-xl border border-border/55 bg-background px-3 py-2.5"
                  >
                    <p className="text-xs font-medium text-foreground">{group.title}</p>
                    <p className="mt-1 truncate text-[11px] text-muted-foreground">
                      {group.items.slice(0, 3).join(' · ')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
          {messages.map((message) => (
            <MessageItem
              key={message.id}
              message={message}
              canEdit={status !== 'loading' && status !== 'streaming' && status !== 'confirming'}
              onEditMessage={onEditMessage}
            />
          ))}

          {(status === 'loading' || status === 'streaming') &&
            (!messages[messages.length - 1] ||
              messages[messages.length - 1].role !== 'assistant' ||
              messages[messages.length - 1].content.length === 0) && (
              <div className="flex items-center gap-3 rounded-xl border border-info/20 bg-info/6 px-4 py-3 text-xs font-medium text-info">
                <span className="flex gap-1" aria-hidden="true">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-info [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-info [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-info" />
                </span>
                <span>正在准备回答</span>
              </div>
            )}

          {browserTaskProgress && <BrowserTaskProgressPanel progress={browserTaskProgress} />}

          {error && (
            <div className="rounded-xl border border-destructive/25 bg-destructive/8 px-4 py-3 text-sm text-destructive">
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
