// PageAgent AI tool - Execute natural language tasks on the user-selected page
import { browser } from 'wxt/browser';
import { logger } from '@/utils/logger';
import { createToolParameter, toolRegistry } from '../tools';
import type { ToolHandler } from '../tools';

/**
 * Execute a natural language task on the user-selected page using PageAgent
 */
async function pageagent_execute_task(args: { task: string }): Promise<{
  success: boolean;
  message: string;
}> {
  logger.info('[PageAgent Tool] 开始执行任务:', args.task);

  // 获取已选择的标签页 ID，null 表示使用当前活动标签页
  // session storage 中没有该 key 或值为 null 时，表示使用始终为当前标签模式
  let tabId: number | null = null;
  try {
    const result = await browser.storage.session.get('__pageAgentTabId');
    logger.info('[PageAgent Tool] session storage result:', JSON.stringify(result));
    const storedValue = result.__pageAgentTabId;
    // 只有当值是数字时才使用该值，否则默认使用始终为当前标签模式（null）
    tabId = typeof storedValue === 'number' ? storedValue : null;
    logger.info('[PageAgent Tool] tabId from storage:', tabId);
  } catch (error) {
    logger.error('[PageAgent Tool] 读取 session storage 失败:', error);
  }

  try {
    // tabId 为 null 时表示"始终为当前标签"模式，先获取当前活动标签页再执行
    if (tabId === null) {
      // 始终为当前模式：先获取当前活动标签页
      try {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]?.id) {
          tabId = tabs[0].id;
          logger.info('[PageAgent Tool] 始终为当前模式，使用当前活动标签页:', tabId);
        }
      } catch (e) {
        logger.error('[PageAgent Tool] 获取当前活动标签页失败:', e);
        return { success: false, message: '无法获取当前活动标签页' };
      }
    }

    const message =
      tabId !== null
        ? { type: 'PAGE_AGENT_EXECUTE_TASK_WITH_TAB' as const, task: args.task, tabId }
        : { type: 'PAGE_AGENT_EXECUTE_TASK' as const, task: args.task };
    const response = await browser.runtime.sendMessage(message);

    logger.info('[PageAgent Tool] 收到响应:', JSON.stringify(response));

    // response 是 undefined 说明消息没有到达 background
    if (response === undefined) {
      logger.info('[PageAgent Tool] 响应为 undefined');
      return {
        success: false,
        message: '消息未到达后台，请确保扩展已重新加载',
      };
    }

    if (response?.success) {
      return {
        success: true,
        message: response.result || '任务执行完成',
      };
    } else {
      // 有响应但 success 为 false一定有 error 消息
      return {
        success: false,
        message: response?.error || '执行失败',
      };
    }
  } catch (error) {
    logger.error('[PageAgent Tool] 执行出错:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : '执行失败',
    };
  }
}

/**
 * Register PageAgent tool
 */
export function registerPageAgentTools(): void {
  toolRegistry.register({
    name: 'pageagent_execute_task',
    description:
      '使用 PageAgent 在 SPA（单页应用）网页上执行自然语言任务。用于自动化网页交互，如点击按钮、填写表单、导航等。请用中文吩咐任务，AI 代理会理解和执行。',
    parameters: createToolParameter(
      {
        task: {
          type: 'string',
          description:
            '用中文描述要在页面上执行的任务。例如："点击提交按钮"、"在搜索框输入关键词并搜索"、"滚动页面找到评论区"、"填写登录表单，用户名admin，密码123456"',
        },
      },
      ['task']
    ),
    handler: pageagent_execute_task as ToolHandler,
    requiresConfirmation: true,
  });
}
