import type { ChatMessage } from '@/lib/ai/types';

export const BROWSER_TASK_HOST_PORT_NAME = 'DPP_BROWSER_TASK_HOST';

export type BrowserTaskStatus =
  | 'queued'
  | 'running'
  | 'waiting_user'
  | 'completed'
  | 'failed'
  | 'stopped';
export type BrowserTaskStopSource = 'chat' | 'browser' | 'system' | 'timeout';

export interface BrowserTaskSummary {
  taskId: string;
  agentRole?: 'browser';
  sessionId?: string;
  toolCallId?: string;
  task: string;
  groupId?: number | null;
  initialTabId: number;
  resourceKeys?: string[];
  status: BrowserTaskStatus;
  stopSource?: BrowserTaskStopSource;
  history: unknown[];
  conversation?: ChatMessage[];
  activity?: unknown;
  result?: string;
  error?: string;
  createdAt?: number;
  updatedAt: number;
}

export interface BrowserTaskStartMessage {
  type: 'BROWSER_TASK_START';
  taskId: string;
  task: string;
  sessionId?: string;
  toolCallId?: string;
  initialTabId: number;
  resourceKeys?: string[];
  resultMode?: 'test-step';
  closeInitialTab?: boolean;
}

export interface BrowserTaskStopMessage {
  type: 'BROWSER_TASK_STOP';
  taskId: string;
  sessionId?: string;
  source?: BrowserTaskStopSource;
}

export interface BrowserTaskResumeMessage {
  type: 'BROWSER_TASK_RESUME';
  taskId: string;
  sessionId?: string;
}

export interface BrowserTaskStatusMessage {
  type: 'BROWSER_TASK_GET_STATUS' | 'BROWSER_TASK_GET_DETAIL';
  taskId: string;
  sessionId?: string;
}

export type BrowserTaskMessage =
  | BrowserTaskStartMessage
  | BrowserTaskStopMessage
  | BrowserTaskResumeMessage
  | BrowserTaskStatusMessage;
