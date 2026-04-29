import type { OpenAIToolCall } from '@/lib/ai/types';

export type ToolCall = OpenAIToolCall;

export interface PreparedToolCall {
  toolCall: ToolCall;
  arguments: Record<string, unknown>;
}

export type AIChatStatus = 'idle' | 'loading' | 'streaming' | 'error' | 'confirming';

export interface PendingToolCall {
  toolCall: ToolCall;
  arguments: Record<string, unknown>;
}

export interface PendingToolCalls {
  toolCalls: ToolCall[];
  argumentsList: Record<string, unknown>[];
}

export interface PendingBuild {
  jobUrl: string;
  jobName: string;
  toolCallId: string;
  toolName: string;
  remainingToolCalls: ToolCall[];
}

export interface UseAIChatReturn {
  messages: import('../types').ChatMessage[];
  status: AIChatStatus;
  error: string | null;
  pendingToolCall: PendingToolCall | null;
  pendingToolCalls: PendingToolCalls | null;
  pendingBuild: PendingBuild | null;
  sessionId: string | null;
  sessions: import('../types').AISession[];
  currentProvider: import('@/lib/ai/types').AIProviderType | null;
  yoloMode: boolean;
  setYoloMode: (value: boolean) => void;
  isRunning: boolean;
  sendMessage: (content: string) => Promise<void>;
  stop: () => void;
  confirmToolCall: () => Promise<void>;
  confirmAllToolCalls: () => Promise<void>;
  cancelToolCall: () => void;
  clearMessages: () => void;
  createNewSession: () => Promise<void>;
  switchSession: (id: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  resetProvider: () => void;
  completeBuild: () => void;
  cancelBuild: () => void;
  summarizeSession: () => Promise<string | null>;
}
