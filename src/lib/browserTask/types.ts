export const BROWSER_TASK_STORAGE_KEY = '__dpp_browser_task';
export const BROWSER_TASK_GROUP_STORAGE_KEY = '__dpp_browser_task_group';
export const BROWSER_TASK_FOLLOW_STORAGE_KEY = '__dpp_browser_task_follow';
export const BROWSER_TASK_CHECKPOINT_STORAGE_KEY = '__dpp_browser_task_checkpoint';

export type BrowserTaskStatus = 'running' | 'waiting_user' | 'completed' | 'failed' | 'stopped';

export interface BrowserElementRef {
  id: string;
  tag: string;
  role: string;
  text: string;
  label: string;
  locator: string;
  fingerprint: string;
  href?: string;
}

export interface BrowserSnapshot {
  url: string;
  title: string;
  text: string;
  elements: BrowserElementRef[];
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
  | 'set_locked';

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
}

export interface BrowserTaskSummary {
  taskId: string;
  sessionId?: string;
  task: string;
  groupName?: string;
  initialTabId: number;
  status: BrowserTaskStatus;
  history: unknown[];
  activity?: unknown;
  modelOutput?: string;
  result?: string;
  error?: string;
  updatedAt: number;
}

export interface BrowserTaskStartMessage {
  type: 'BROWSER_TASK_START';
  taskId: string;
  task: string;
  sessionId?: string;
  groupName?: string;
  initialTabId: number;
  resumeTaskId?: string;
}

export interface BrowserTaskCheckpoint {
  taskId: string;
  task: string;
  currentTabId: number;
  tabs: BrowserTabState[];
  ownedTabIds?: number[];
  recentActions: BrowserActionState[];
  visitedUrls: string[];
  updatedAt: number;
}

export interface BrowserTaskStopMessage {
  type: 'BROWSER_TASK_STOP';
  taskId: string;
}

export interface BrowserTaskResumeMessage {
  type: 'BROWSER_TASK_RESUME';
  taskId: string;
}

export interface BrowserTaskStatusMessage {
  type: 'BROWSER_TASK_GET_STATUS' | 'BROWSER_TASK_SUBSCRIBE';
  taskId: string;
}

export type BrowserTaskMessage =
  | BrowserTaskStartMessage
  | BrowserTaskStopMessage
  | BrowserTaskResumeMessage
  | BrowserTaskStatusMessage;
