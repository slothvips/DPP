import { ArrowDown } from 'lucide-react';
import type { RefObject, UIEventHandler } from 'react';
import { Button } from '@/components/ui/button';
import type { AIChatStatus } from '../hooks/useAIChat.types';
import type { ChatMessage } from '../types';
import { AIConfigDialog } from './AIConfigDialog';
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
}: AIAssistantMessagesPanelProps) {
  return (
    <div className="relative min-h-0 flex-1 overflow-hidden bg-gradient-to-b from-info/4 via-background to-background">
      <div
        ref={messagesContainerRef}
        onScroll={onScroll}
        className="absolute inset-0 space-y-4 overflow-y-auto px-4 py-4 custom-scrollbar"
      >
        {isConfigMissing && messages.length === 0 && (
          <div className="flex h-full items-center justify-center text-center">
            <div className="w-full max-w-md rounded-2xl border border-border/60 bg-background/90 px-6 py-8">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/9 text-2xl text-primary ring-1 ring-primary/12">
                ⚙️
              </div>
              <p className="text-sm font-semibold text-foreground">需要配置 AI 服务</p>
              <p className="mt-2 text-xs leading-6 text-muted-foreground">
                请先配置 AI 服务商和模型
              </p>
              <AIConfigDialog onSaved={onConfigSaved}>
                <Button className="mt-5 rounded-xl px-4" size="sm">
                  去配置
                </Button>
              </AIConfigDialog>
            </div>
          </div>
        )}

        {!isConfigMissing && messages.length === 0 && (
          <div className="flex min-h-full items-center justify-center px-4 py-8">
            <div className="max-w-xl rounded-3xl border border-border/60 bg-background/90 p-6 text-center text-muted-foreground">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/9 text-2xl text-primary ring-1 ring-primary/12">
                🤖
              </div>
              <p className="mt-4 text-sm font-semibold text-foreground">你好！我是 D仔</p>
              <p className="mt-2 text-xs leading-6">
                直接描述目标即可，我会调用 DPP 里的能力一步步完成。
              </p>
              <p className="mt-1 text-xs leading-6">
                涉及新增、删除、构建、同步或页面操作时，会先和你确认。
              </p>

              <div className="mt-5 space-y-3 text-xs leading-6">
                {CAPABILITY_GROUPS.map((group) => (
                  <p key={group.title}>
                    <span className="font-medium text-foreground">{group.title}：</span>
                    <span>{group.items.join('、')}</span>
                  </p>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <MessageItem key={message.id} message={message} />
        ))}

        {(status === 'loading' || status === 'streaming') && (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-info/12 bg-info/6 px-4 py-3">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-foreground">思考中</span>
                <span className="animate-pulse text-sm text-muted-foreground">...</span>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="flex justify-center px-2">
            <div className="rounded-2xl border border-destructive/16 bg-destructive/8 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {!isNearBottom && (
        <button
          onClick={onScrollToBottom}
          className="absolute bottom-4 right-4 rounded-full border border-border/70 bg-background/95 p-2 text-primary shadow-lg backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/18"
          title="直达底部"
        >
          <ArrowDown className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
