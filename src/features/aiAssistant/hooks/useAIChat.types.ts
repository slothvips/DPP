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
  requiresActivePlan: boolean;
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
  reasoning: string;
  status: AIChatStatus;
  error: string | null;
  pendingToolCall: PendingToolCall | null;
  pendingToolCalls: PendingToolCalls | null;
  pendingBuild: PendingBuild | null;
  sessionId: string | null;
  sessions: import('../types').AISession[];
  sessionStatuses: Record<string, AIChatStatus>;
  currentProvider: import('@/lib/ai/types').AIProviderType | null;
  currentProviderName: string | null;
  currentModel: string | null;
  yoloMode: boolean;
  setYoloMode: (value: boolean) => void;
  isRunning: boolean;
  sendMessage: (content: string) => Promise<void>;
  stop: (stopBrowserTask?: boolean) => void;
  confirmToolCall: () => Promise<void>;
  confirmAllToolCalls: () => Promise<void>;
  cancelToolCall: () => void;
  clearMessages: () => Promise<void>;
  editMessage: (messageId: string, content: string) => Promise<void>;
  createNewSession: () => Promise<void>;
  switchSession: (id: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  resetProvider: () => void;
  completeBuild: () => void;
  cancelBuild: () => void;
  summarizeSession: () => Promise<boolean>;
}
