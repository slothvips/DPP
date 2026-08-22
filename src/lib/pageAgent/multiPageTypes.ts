import type { BrowserState } from '@page-agent/page-controller';

export const PAGE_AGENT_TASK_STORAGE_KEY = '__dpp_page_agent_task';
export const PAGE_AGENT_TASK_GROUP_STORAGE_KEY = '__dpp_page_agent_task_group';

export type PageAgentTaskStatus =
  | 'queued'
  | 'running'
  | 'stopping'
  | 'completed'
  | 'failed'
  | 'stopped';

export interface PageAgentTaskSummary {
  taskId: string;
  sessionId?: string;
  task: string;
  groupName?: string;
  initialTabId: number;
  status: PageAgentTaskStatus;
  activity?: unknown;
  history: unknown[];
  result?: { success: boolean; data: string };
  error?: string;
  updatedAt: number;
}

export interface PageAgentTaskStartMessage {
  type: 'PAGE_AGENT_TASK_START';
  taskId: string;
  task: string;
  sessionId?: string;
  groupName?: string;
  initialTabId: number;
}

export interface PageAgentTaskStopMessage {
  type: 'PAGE_AGENT_TASK_STOP';
  taskId: string;
}

export interface PageAgentTaskGetStatusMessage {
  type: 'PAGE_AGENT_TASK_GET_STATUS';
  taskId: string;
}

export interface PageAgentTaskSubscribeMessage {
  type: 'PAGE_AGENT_TASK_SUBSCRIBE';
  taskId: string;
}

export interface PageAgentTaskEventMessage {
  type: 'PAGE_AGENT_TASK_EVENT';
  taskId: string;
  event: Partial<PageAgentTaskSummary>;
}

export interface PageAgentTaskResultMessage {
  type: 'PAGE_AGENT_TASK_RESULT';
  taskId: string;
  result: PageAgentTaskSummary['result'];
  error?: string;
}

export type PageAgentTaskMessage =
  | PageAgentTaskStartMessage
  | PageAgentTaskStopMessage
  | PageAgentTaskGetStatusMessage
  | PageAgentTaskSubscribeMessage
  | PageAgentTaskEventMessage
  | PageAgentTaskResultMessage;

export interface PageAgentLlmRequestMessage {
  type: 'PAGE_AGENT_LLM_REQUEST';
  requestId: string;
  taskId: string;
  body: string;
}

export interface PageAgentLlmAbortMessage {
  type: 'PAGE_AGENT_LLM_ABORT';
  requestId: string;
  taskId: string;
}

export type PageControlAction =
  | 'get_last_update_time'
  | 'get_browser_state'
  | 'update_tree'
  | 'clean_up_highlights'
  | 'click_element'
  | 'input_text'
  | 'select_option'
  | 'scroll'
  | 'scroll_horizontally';

export type TabControlAction =
  | 'get_tab_info'
  | 'get_window_tabs'
  | 'open_new_tab'
  | 'close_tab'
  | 'group_tabs'
  | 'update_tab_group';

export interface PageControlMessage {
  type: 'PAGE_AGENT_PAGE_CONTROL';
  action: PageControlAction;
  targetTabId: number;
  payload?: unknown[];
}

export interface PageControllerReadyMessage {
  type: 'PAGE_AGENT_PAGE_CONTROLLER_READY';
}

export interface TabControlMessage {
  type: 'PAGE_AGENT_TAB_CONTROL';
  action: TabControlAction;
  payload: Record<string, unknown>;
}

export interface PageActionResult {
  success: boolean;
  message: string;
}

export type PageControlResponse = BrowserState | PageActionResult | number | string | void;

export type PageAgentRuntimeMessage =
  | PageAgentTaskMessage
  | PageAgentLlmRequestMessage
  | PageAgentLlmAbortMessage;
