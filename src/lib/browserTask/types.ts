import type { ChatMessage } from '@/lib/ai/types';

export const BROWSER_TASK_HOST_PORT_NAME = 'DPP_BROWSER_TASK_HOST';

export type BrowserTaskStatus =
  | 'queued'
  | 'running'
  | 'waiting_user'
  | 'completed'
  | 'failed'
  | 'stopped';
export type BrowserTaskStopSource = 'chat' | 'browser' | 'system';

export interface BrowserElementRef {
  id: string;
  tag: string;
  role: string;
  text: string;
  label: string;
  locator: string;
  fingerprint: string;
  href?: string;
  fileUploader?: boolean;
  scroll?: BrowserElementScrollInfo;
}

export interface BrowserElementScrollInfo {
  vertical?: BrowserScrollInfo;
  horizontal?: BrowserScrollInfo;
}

export interface BrowserScrollInfo {
  scrollLeft: number;
  clientWidth: number;
  scrollWidth: number;
  scrollTop: number;
  clientHeight: number;
  scrollHeight: number;
  canScrollLeft: boolean;
  canScrollRight: boolean;
  canScrollUp: boolean;
  canScrollDown: boolean;
}

export interface BrowserSnapshot {
  url: string;
  title: string;
  text: string;
  elements: BrowserElementRef[];
  scroll?: BrowserScrollInfo;
  readiness: BrowserReadiness;
}

export interface BrowserReadiness {
  documentReadyState: DocumentReadyState;
  stable: boolean;
  stableForMs: number;
  observedAt: number;
}

export type DocumentReadyState = 'loading' | 'interactive' | 'complete';

export type BrowserAction =
  | 'observe'
  | 'hover'
  | 'inspect'
  | 'click'
  | 'fill'
  | 'select'
  | 'scroll'
  | 'scroll_to_percent'
  | 'scroll_to_top'
  | 'scroll_to_bottom'
  | 'scroll_page'
  | 'scroll_to_text'
  | 'send_keys'
  | 'get_dropdown_options'
  | 'navigate'
  | 'open_tab'
  | 'switch_tab'
  | 'close_tab'
  | 'go_back'
  | 'go_forward'
  | 'refresh'
  | 'get_readiness';

export interface BrowserTabState {
  id: number;
  title: string;
  url: string;
  isCurrent: boolean;
}

export interface BrowserActionState {
  action: string;
  result: string;
  error?: boolean;
  urlBefore: string;
  urlAfter: string;
  tabIdBefore: number;
  tabIdAfter: number;
  /** 动作导致任务切换到了另一个标签页（新开或切换） */
  switchedToTabId?: number;
  /** 动作导致页面发生导航时的前后 URL */
  navigatedFrom?: string;
  navigatedTo?: string;
}

export interface BrowserTaskState {
  currentTabId: number;
  tabs: BrowserTabState[];
  page: BrowserSnapshot;
  recentActions: BrowserActionState[];
  visitedUrls: string[];
}

export interface BrowserControlMessage {
  type: 'BROWSER_CONTROL';
  action: BrowserAction;
  targetTabId: number;
  payload?: Record<string, unknown>;
}

export interface BrowserControlResponse {
  success: boolean;
  message?: string;
  snapshot?: BrowserSnapshot;
  readiness?: BrowserReadiness;
}

export interface BrowserTaskSummary {
  taskId: string;
  agentRole?: 'browser';
  sessionId?: string;
  toolCallId?: string;
  task: string;
  groupId?: number | null;
  initialTabId: number;
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
}

export interface BrowserTaskStopMessage {
  type: 'BROWSER_TASK_STOP';
  taskId: string;
  source?: BrowserTaskStopSource;
}

export interface BrowserTaskResumeMessage {
  type: 'BROWSER_TASK_RESUME';
  taskId: string;
}

export interface BrowserTaskStatusMessage {
  type: 'BROWSER_TASK_GET_STATUS' | 'BROWSER_TASK_GET_DETAIL';
  taskId: string;
}

export type BrowserTaskMessage =
  | BrowserTaskStartMessage
  | BrowserTaskStopMessage
  | BrowserTaskResumeMessage
  | BrowserTaskStatusMessage;
