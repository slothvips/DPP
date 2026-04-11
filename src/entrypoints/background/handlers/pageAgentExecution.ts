import { browser } from 'wxt/browser';
import { clearExistingAgent, injectPageAgent } from '@/lib/pageAgent/injector';
import type { PageAgentExecuteResponse, PageAgentInjectResponse } from '@/lib/pageAgent/types';
import { logger } from '@/utils/logger';
import type { AIConfigValidationResult } from './pageAgentConfig';

const PAGE_AGENT_INIT_RETRIES = 10;
const PAGE_AGENT_INIT_DELAY_MS = 500;

async function isPageAgentInjected(tabId: number): Promise<boolean> {
  try {
    const result = await browser.scripting.executeScript({
      target: { tabId },
      func: () => !!window.__DPP_PAGE_AGENT__,
    });
    return result[0]?.result === true;
  } catch {
    return false;
  }
}

export async function injectAndWaitUntilReady(
  tabId: number,
  config: AIConfigValidationResult
): Promise<PageAgentInjectResponse> {
  if (!config.success) {
    return { success: false, error: config.error };
  }

  const injectResult = await injectPageAgent(tabId, config.config);
  if (!injectResult.success) {
    logger.info('[PageAgent] 注入失败:', injectResult.error);
    return { success: false, error: injectResult.error };
  }

  logger.info('[PageAgent] 注入成功，等待初始化...');

  let retries = PAGE_AGENT_INIT_RETRIES;
  while (retries > 0) {
    const injected = await isPageAgentInjected(tabId);
    logger.info('[PageAgent] 检查注入状态:', injected, '剩余重试:', retries);
    if (injected) {
      return { success: true };
    }

    await new Promise((resolve) => setTimeout(resolve, PAGE_AGENT_INIT_DELAY_MS));
    retries--;
  }

  logger.info('[PageAgent] 初始化超时，清理已注入的脚本');
  await clearExistingAgent(tabId);
  return { success: false, error: 'Page Agent 初始化超时' };
}

function mapExecuteError(error: unknown): PageAgentExecuteResponse {
  const errorMessage = error instanceof Error ? error.message : '执行任务失败';
  logger.error('[PageAgent] 执行出错:', error);

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

export async function executeTaskOnTab(
  tabId: number,
  task: string
): Promise<PageAgentExecuteResponse> {
  logger.info('[PageAgent] 开始执行任务:', task);

  try {
    const execResult = await browser.scripting.executeScript({
      target: { tabId },
      func: (taskText: string) => {
        const agent = window.__DPP_PAGE_AGENT__;
        if (!agent) {
          throw new Error('PageAgent 未初始化');
        }

        return agent.execute(taskText).then((result) => ({
          success: result.success,
          data: result.data,
        }));
      },
      args: [task],
    });
    logger.info('[PageAgent] 执行脚本返回:', JSON.stringify(execResult));
    const result = execResult[0]?.result as { data: string; success: boolean } | undefined;

    if (!result) {
      logger.info('[PageAgent] 执行结果无效');
      return { success: false, error: '执行结果无效' };
    }

    return {
      success: result.success,
      result: result.data,
    };
  } catch (error) {
    return mapExecuteError(error);
  }
}
