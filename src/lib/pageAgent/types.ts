// src/lib/pageAgent/types.ts
// Page-Agent 集成类型定义

/**
 * PageAgent ExecutionResult
 */
export interface PageAgentExecutionResult {
  success: boolean;
  data: string;
}

/**
 * PageAgent 实例接口
 */
export interface PageAgentInstance {
  execute: (task: string) => Promise<PageAgentExecutionResult>;
  stop: () => void;
  panel?: {
    show: () => void;
    expand: () => void;
    isVisible?: () => boolean;
    wrapper?: HTMLElement;
  };
}

/**
 * 扩展 Window 接口
 */
declare global {
  interface Window {
    __DPP_PAGE_AGENT__?: PageAgentInstance;
  }
}

/**
 * PageAgent 初始化配置
 */
export interface PageAgentConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

/**
 * 注入请求消息
 */
export interface PageAgentInjectRequest {
  type: 'PAGE_AGENT_INJECT';
}

/**
 * 指定标签页注入请求消息
 */
export interface PageAgentInjectWithTabRequest {
  type: 'PAGE_AGENT_INJECT_WITH_TAB';
  tabId: number;
}

/**
 * 指定标签页执行任务请求消息
 */
export interface PageAgentExecuteTaskWithTabRequest {
  type: 'PAGE_AGENT_EXECUTE_TASK_WITH_TAB';
  task: string;
  tabId: number;
}

/**
 * 注入响应
 */
export interface PageAgentInjectResponse {
  success: boolean;
  error?: string;
}

/**
 * 执行任务请求消息
 */
export interface PageAgentExecuteRequest {
  type: 'PAGE_AGENT_EXECUTE_TASK';
  task: string;
}

/**
 * 执行任务响应
 */
export interface PageAgentExecuteResponse {
  success: boolean;
  result?: string;
  error?: string;
}
