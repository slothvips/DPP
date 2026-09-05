// Hot News and Sync AI tools
import { syncEngine } from '@/db';
import { getHotNews } from '@/lib/db/hotnews';
import { createToolParameter, toolRegistry } from '../tools';
import type { ToolHandler } from '../tools';

/**
 * Get Beijing date string accounting for timezone differences
 */
function getBejingDate(offsetDays = 0): string {
  const now = new Date();
  const bjOffset = 8 * 60 * 60 * 1000;
  const bjTime = new Date(now.getTime() + bjOffset - offsetDays * 24 * 60 * 60 * 1000);
  const year = bjTime.getUTCFullYear();
  const month = String(bjTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(bjTime.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get hot news from cache
 */
async function hotnews_get(args: { date?: string; limit?: number }) {
  const date = args.date || getBejingDate(0);
  const limit = Math.min(Math.max(1, args.limit ?? 50), 100);

  // Try to get from cache
  const cached = await getHotNews({ date });
  if (!cached) {
    return {
      date,
      message: '暂无热榜数据，请先打开热榜页面获取数据。',
      sections: [],
    };
  }

  const data = cached.data as {
    sections?: Array<{
      source: string;
      icon: string;
      items?: Array<{ title: string; url: string; hot?: number }>;
    }>;
  };

  const sections =
    data.sections?.map((section) => ({
      title: `${section.icon} ${section.source}`,
      news:
        section.items?.slice(0, limit).map((item) => ({
          title: item.title,
          url: item.url,
          hot: item.hot,
        })) || [],
      total: section.items?.length ?? 0,
      truncated: (section.items?.length ?? 0) > limit,
    })) || [];
  return {
    date: cached.date,
    source: 'cache',
    sections,
  };
}

/**
 * Trigger sync
 */
async function sync_trigger() {
  try {
    await syncEngine.push();
    await syncEngine.pull();
    return {
      success: true,
      message: '同步成功完成',
    };
  } catch (error) {
    throw new Error(`同步失败：${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Register all hotnews and sync tools
 */
export function registerHotNewsTools() {
  // hotnews_get
  toolRegistry.register({
    name: 'hotnews_get',
    description: '获取今日热榜列表',
    parameters: createToolParameter(
      {
        date: {
          type: 'string',
          description: 'YYYY-MM-DD 格式的日期，可选，默认使用今天',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          description: '每个榜单最多返回多少条，默认 50，最大 100',
        },
      },
      []
    ),
    handler: hotnews_get as ToolHandler,
  });

  // sync_trigger (requires confirmation)
  toolRegistry.register({
    name: 'sync_trigger',
    description: '触发全局同步（推送和拉取）',
    parameters: createToolParameter({}, []),
    handler: sync_trigger as ToolHandler,
    requiresConfirmation: true,
  });
}
