export type PageControlAction =
  | 'get_last_update_time'
  | 'get_browser_state'
  | 'read_page'
  | 'update_tree'
  | 'clean_up_highlights'
  | 'click_element'
  | 'input_text'
  | 'select_option'
  | 'scroll'
  | 'scroll_horizontally';

export interface PageControlMessage {
  type: 'PAGE_AGENT_PAGE_CONTROL';
  action: PageControlAction;
  targetTabId: number;
  payload?: unknown[];
}

export type TabControlAction =
  | 'get_tab_info'
  | 'get_window_tabs'
  | 'open_new_tab'
  | 'close_tab'
  | 'group_tabs'
  | 'update_tab_group';

export interface TabControlMessage {
  type: 'PAGE_AGENT_TAB_CONTROL';
  action: TabControlAction;
  payload: Record<string, unknown>;
}

export interface PageAgentTaskSummary {
  taskId: string;
  sessionId?: string;
  task: string;
  status: 'running' | 'stopped' | 'completed' | 'failed';
  history: unknown[];
  activity?: unknown;
  result?: { success: boolean; data: string };
  error?: string;
  updatedAt: number;
}

export type PageAgentTaskMessage =
  | { type: 'PAGE_AGENT_TASK_START'; taskId: string; task: string; initialTabId: number }
  | { type: 'PAGE_AGENT_TASK_STOP'; taskId: string }
  | { type: 'PAGE_AGENT_TASK_GET_STATUS'; taskId: string }
  | { type: 'PAGE_AGENT_TASK_SUBSCRIBE'; taskId: string };

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
