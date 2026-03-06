// Recent activities AI tool - register get_recent_activities tool
import { createToolParameter, toolRegistry } from '../tools';
import type { ToolHandler } from '../tools';
import { getRecentActivities } from './getRecentActivities';

/**
 * Get recent user activities within specified days
 * @param days - 查询最近多少天的操作记录，范围 1-15
 * @param detailLevel - 返回信息的详细程度: summary(默认,中等粒度) 或 detailed(完整详细信息)
 */
async function get_recent_activities(args: { days: number; detailLevel?: 'summary' | 'detailed' }) {
  return getRecentActivities(args);
}

/**
 * Register recent activities tool
 */
export function registerRecentActivitiesTools() {
  toolRegistry.register({
    name: 'get_recent_activities',
    description: '获取最近一段时间的用户操作记录，用于回答"查看最近做了什么"等问题',
    parameters: createToolParameter(
      {
        days: {
          type: 'number',
          description: '查询最近多少天的操作记录，范围 1-15',
        },
        detailLevel: {
          type: 'string',
          enum: ['summary', 'detailed'],
          description:
            '返回信息的详细程度: summary(默认,中等粒度摘要) 或 detailed(完整详细信息,包含URL、内容等)。当用户追问"更详细"、"查看完整记录"时使用 detailed',
        },
      },
      ['days']
    ),
    handler: get_recent_activities as ToolHandler,
  });
}
