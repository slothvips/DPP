// src/entrypoints/background/handlers/pageAgent.ts
// PageAgent 注入请求处理器
import { browser } from 'wxt/browser';
import { getAIConfig } from '@/lib/db/settings';
import {
  clearAllAgents,
  clearExistingAgent,
  injectPageAgent,
  isInjectable,
} from '@/lib/pageAgent/injector';
import type {
  PageAgentExecuteRequest,
  PageAgentExecuteResponse,
  PageAgentExecuteTaskWithTabRequest,
  PageAgentInjectRequest,
  PageAgentInjectResponse,
  PageAgentInjectWithTabRequest,
} from '@/lib/pageAgent/types';
import { logger } from '@/utils/logger';

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

/**
 * 验证 AI 配置并返回配置或错误
 */
async function validateAIConfig(): Promise<
  | { success: true; config: { baseUrl: string; apiKey: string; model: string } }
  | { success: false; error: string }
> {
  const aiConfig = await getAIConfig();

  if (!aiConfig) {
    return { success: false, error: '请先配置 AI 服务' };
  }

  if (!aiConfig.apiKey) {
    return { success: false, error: '请先配置 API Key' };
  }

  if (aiConfig.isAnthropicProvider) {
    return {
      success: false,
      error:
        'Page Agent 仅支持 OpenAI 兼容格式的 API。Anthropic 供应商使用的是 Anthropic 格式端点，不兼容。请切换到其他供应商（如 OpenAI、DeepSeek、Qwen 等），或使用 OpenAI 兼容的第三方代理服务。',
    };
  }

  return {
    success: true,
    config: {
      baseUrl: aiConfig.baseUrl,
      apiKey: aiConfig.apiKey || '',
      model: aiConfig.model,
    },
  };
}

export async function handlePageAgentInject(
  _request: PageAgentInjectRequest
): Promise<PageAgentInjectResponse> {
  // 始终使用当前活动标签页
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const activeTab = tabs[0];

  if (!activeTab?.id || !activeTab?.url) {
    return { success: false, error: '无法获取当前标签页' };
  }

  if (!isInjectable(activeTab.url)) {
    return { success: false, error: '无法在此页面使用 Page Agent' };
  }

  const aiConfigResult = await validateAIConfig();
  if (!aiConfigResult.success) {
    return { success: false, error: aiConfigResult.error };
  }

  return injectPageAgent(activeTab.id, {
    baseUrl: aiConfigResult.config.baseUrl,
    apiKey: aiConfigResult.config.apiKey,
    model: aiConfigResult.config.model,
  });
}

/**
 * 处理指定标签页的 PageAgent 注入请求
 */
export async function handlePageAgentInjectWithTab(
  request: PageAgentInjectWithTabRequest
): Promise<PageAgentInjectResponse> {
  const { tabId } = request;

  // 获取指定标签页信息
  let tab;
  try {
    tab = await browser.tabs.get(tabId);
  } catch {
    return { success: false, error: '无法获取指定标签页' };
  }

  if (!tab?.url) {
    return { success: false, error: '无法获取指定标签页 URL' };
  }

  if (!isInjectable(tab.url)) {
    return { success: false, error: '无法在此页面使用 Page Agent' };
  }

  const aiConfigResult = await validateAIConfig();
  if (!aiConfigResult.success) {
    return { success: false, error: aiConfigResult.error };
  }

  return injectPageAgent(tabId, {
    baseUrl: aiConfigResult.config.baseUrl,
    apiKey: aiConfigResult.config.apiKey,
    model: aiConfigResult.config.model,
  });
}

/**
 * 检查页面是否已注入 PageAgent
 */
async function isPageAgentInjected(tabId: number): Promise<boolean> {
  try {
    const result = await browser.scripting.executeScript({
      target: { tabId },
      func: () => {
        return !!window.__DPP_PAGE_AGENT__;
      },
    });
    return result[0]?.result === true;
  } catch {
    return false;
  }
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

  // 始终使用当前活动标签页
  let tabs;
  try {
    tabs = await browser.tabs.query({ active: true, currentWindow: true });
    logger.info('[PageAgent] 获取标签页成功:', tabs?.length);
  } catch (e) {
    logger.info('[PageAgent] 获取标签页失败:', e);
    return { success: false, error: '获取标签页失败' };
  }

  const tabId = tabs[0]?.id;
  const tabUrl = tabs[0]?.url;
  if (!tabId || !tabUrl) {
    return { success: false, error: '无法获取标签页' };
  }

  if (!isInjectable(tabUrl)) {
    return { success: false, error: '无法在此页面使用 Page Agent' };
  }

  const aiConfigResult = await validateAIConfig();
  if (!aiConfigResult.success) {
    return { success: false, error: aiConfigResult.error };
  }

  // 注入 PageAgent（如果尚未注入）
  const injectResult = await injectPageAgent(tabId, {
    baseUrl: aiConfigResult.config.baseUrl,
    apiKey: aiConfigResult.config.apiKey,
    model: aiConfigResult.config.model,
  });

  if (!injectResult.success) {
    logger.info('[PageAgent] 注入失败:', injectResult.error);
    return { success: false, error: injectResult.error };
  }

  logger.info('[PageAgent] 注入成功，等待初始化...');

  // 等待 PageAgent 初始化
  let retries = 10;
  while (retries > 0) {
    const injected = await isPageAgentInjected(tabId);
    logger.info('[PageAgent] 检查注入状态:', injected, '剩余重试:', retries);
    if (injected) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
    retries--;
  }

  if (retries === 0) {
    logger.info('[PageAgent] 初始化超时，清理已注入的脚本');
    await clearExistingAgent(tabId);
    return { success: false, error: 'Page Agent 初始化超时' };
  }

  logger.info('[PageAgent] 开始执行任务:', request.task);

  // 执行任务
  try {
    const execResult = await browser.scripting.executeScript({
      target: { tabId: tabId },
      func: (task: string) => {
        const agent = window.__DPP_PAGE_AGENT__;
        if (!agent) {
          throw new Error('PageAgent 未初始化');
        }
        // 必须等待 Promise 完成，因为 execute 返回的是 Promise
        return agent.execute(task).then((result) => ({
          success: result.success,
          data: result.data,
        }));
      },
      args: [request.task],
    });
    logger.info('[PageAgent] 执行脚本返回:', JSON.stringify(execResult));
    const result = execResult[0]?.result as { data: string; success: boolean } | undefined;
    if (result) {
      return {
        success: result.success,
        result: result.data,
      };
    }
    logger.info('[PageAgent] 执行结果无效');
    return { success: false, error: '执行结果无效' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '执行任务失败';
    logger.error('[PageAgent] 执行出错:', error);

    // 检测是否是 tab 不可用错误，如果是则返回特殊错误码告知 AI 立即停止
    const isTabUnavailable =
      errorMessage.includes('No tab with id') ||
      errorMessage.includes('tab not found') ||
      errorMessage.includes('Extension context invalidated') ||
      errorMessage.includes('Receiving end does not exist');

    if (isTabUnavailable) {
      return {
        success: false,
        error: '__TAB_UNAVAILABLE__ 工作标签页已消失或不可用，请等待用户重新选择标签页后再试',
      };
    }

    // 检测是否是 AbortError（通常表示执行超时或被取消）
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        error: '任务执行超时或被取消，请重试',
      };
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * 处理指定标签页的 PageAgent 执行任务请求
 */
export async function handlePageAgentExecuteTaskWithTab(
  request: PageAgentExecuteTaskWithTabRequest
): Promise<PageAgentExecuteResponse> {
  const { task, tabId } = request;

  logger.info('[PageAgent] 收到指定标签页执行任务请求, tabId:', tabId, 'task:', task.slice(0, 50));

  // 获取指定标签页信息
  let tabUrl: string | undefined;
  try {
    const tab = await browser.tabs.get(tabId);
    tabUrl = tab.url;
  } catch {
    return { success: false, error: '无法获取指定标签页' };
  }

  if (!tabUrl) {
    return { success: false, error: '无法获取指定标签页 URL' };
  }

  if (!isInjectable(tabUrl)) {
    return { success: false, error: '无法在此页面使用 Page Agent' };
  }

  const aiConfigResult = await validateAIConfig();
  if (!aiConfigResult.success) {
    return { success: false, error: aiConfigResult.error };
  }

  // 注入 PageAgent（如果尚未注入）
  const injectResult = await injectPageAgent(tabId, {
    baseUrl: aiConfigResult.config.baseUrl,
    apiKey: aiConfigResult.config.apiKey,
    model: aiConfigResult.config.model,
  });

  if (!injectResult.success) {
    logger.info('[PageAgent] 注入失败:', injectResult.error);
    return { success: false, error: injectResult.error };
  }

  logger.info('[PageAgent] 注入成功，等待初始化...');

  // 等待 PageAgent 初始化
  let retries = 10;
  while (retries > 0) {
    const injected = await isPageAgentInjected(tabId);
    logger.info('[PageAgent] 检查注入状态:', injected, '剩余重试:', retries);
    if (injected) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
    retries--;
  }

  if (retries === 0) {
    logger.info('[PageAgent] 初始化超时，清理已注入的脚本');
    await clearExistingAgent(tabId);
    return { success: false, error: 'Page Agent 初始化超时' };
  }

  logger.info('[PageAgent] 开始执行任务:', task);

  // 执行任务
  try {
    const execResult = await browser.scripting.executeScript({
      target: { tabId: tabId },
      func: (task: string) => {
        const agent = window.__DPP_PAGE_AGENT__;
        if (!agent) {
          throw new Error('PageAgent 未初始化');
        }
        // 必须等待 Promise 完成，因为 execute 返回的是 Promise
        return agent.execute(task).then((result) => ({
          success: result.success,
          data: result.data,
        }));
      },
      args: [task],
    });
    logger.info('[PageAgent] 执行脚本返回:', JSON.stringify(execResult));
    const result = execResult[0]?.result as { data: string; success: boolean } | undefined;
    if (result) {
      return {
        success: result.success,
        result: result.data,
      };
    }
    logger.info('[PageAgent] 执行结果无效');
    return { success: false, error: '执行结果无效' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '执行任务失败';
    logger.error('[PageAgent] 执行出错:', error);

    // 检测是否是 tab 不可用错误，如果是则返回特殊错误码告知 AI 立即停止
    const isTabUnavailable =
      errorMessage.includes('No tab with id') ||
      errorMessage.includes('tab not found') ||
      errorMessage.includes('Extension context invalidated') ||
      errorMessage.includes('Receiving end does not exist');

    if (isTabUnavailable) {
      return {
        success: false,
        error: '__TAB_UNAVAILABLE__ 工作标签页已消失或不可用，请等待用户重新选择标签页后再试',
      };
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}
