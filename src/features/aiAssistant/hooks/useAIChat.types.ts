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
  currentRole: import('@/features/aiAssistant/materials/testCaseTypes').AISessionRoleSnapshot;
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
  selectRole: (roleId: string) => Promise<void>;
  switchSession: (id: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  duplicateSession: (id: string) => Promise<void>;
  updateSessionTitle: (id: string, title: string) => Promise<void>;
  setSessionPinned: (id: string, pinned: boolean) => Promise<void>;
  resetProvider: () => void;
  completeBuild: () => void;
  cancelBuild: () => void;
  summarizeSession: () => Promise<boolean>;
  shareSession: (sessionId: string, input: { title: string; summary?: string }) => Promise<void>;
  importConversation: (materialId: string) => Promise<void>;
}
