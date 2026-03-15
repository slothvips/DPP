// src/lib/pageAgent/types.ts
// Page-Agent 集成类型定义

/**
 * PageAgent 实例接口
 */
export interface PageAgentInstance {
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
 * 注入响应
 */
export interface PageAgentInjectResponse {
  success: boolean;
  error?: string;
}
