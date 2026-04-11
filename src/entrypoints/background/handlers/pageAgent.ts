// src/entrypoints/background/handlers/pageAgent.ts
// PageAgent 注入请求处理器
import { clearAllAgents } from '@/lib/pageAgent/injector';
import type {
  PageAgentExecuteRequest,
  PageAgentExecuteResponse,
  PageAgentExecuteTaskWithTabRequest,
  PageAgentInjectRequest,
  PageAgentInjectResponse,
  PageAgentInjectWithTabRequest,
} from '@/lib/pageAgent/types';
import { logger } from '@/utils/logger';
import { handleExecuteForTab, handleInjectForTab } from './pageAgentHelpers';

/**
 * 处理关闭所有 PageAgent 实例的请求
 */
export async function handlePageAgentCloseAll(): Promise<{ success: boolean }> {
  logger.info('[PageAgent] 收到关闭所有实例请求');
  try {
    await clearAllAgents();
    return { success: true };
  } catch (error) {
    logger.error('[PageAgent] 关闭所有实例失败:', error);
    return { success: false };
  }
}

export async function handlePageAgentInject(
  _request: PageAgentInjectRequest
): Promise<PageAgentInjectResponse> {
  return handleInjectForTab();
}

/**
 * 处理指定标签页的 PageAgent 注入请求
 */
export async function handlePageAgentInjectWithTab(
  request: PageAgentInjectWithTabRequest
): Promise<PageAgentInjectResponse> {
  return handleInjectForTab(request.tabId);
}

/**
 * 处理 PageAgent 执行任务请求
 */
export async function handlePageAgentExecute(
  request: PageAgentExecuteRequest
): Promise<PageAgentExecuteResponse> {
  logger.info(
    '[PageAgent] 收到执行任务请求:',
    request.task.slice(0, 50) + (request.task.length > 50 ? '...' : '')
  );

  return handleExecuteForTab(undefined, request.task);
}

/**
 * 处理指定标签页的 PageAgent 执行任务请求
 */
export async function handlePageAgentExecuteTaskWithTab(
  request: PageAgentExecuteTaskWithTabRequest
): Promise<PageAgentExecuteResponse> {
  logger.info(
    '[PageAgent] 收到指定标签页执行任务请求, tabId:',
    request.tabId,
    'task:',
    request.task.slice(0, 50)
  );

  return handleExecuteForTab(request.tabId, request.task);
}
