// Hot News and Sync AI tools
import { db, syncEngine } from '@/db';
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
async function hotnews_get(args: { date?: string }) {
  const date = args.date || getBejingDate(0);

  // Try to get from cache
  const cached = await db.hotNews.get(date);
  if (!cached) {
    return {
      date,
      message: 'No hot news data available. Please open the Hot News tab first to fetch data.',
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

  return {
    date: cached.date,
    source: 'cache',
    sections:
      data.sections?.map((section) => ({
        title: `${section.icon} ${section.source}`,
        news:
          section.items?.map((item) => ({
            title: item.title,
            url: item.url,
            hot: item.hot,
          })) || [],
      })) || [],
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
      message: 'Sync completed successfully',
    };
  } catch (error) {
    throw new Error(`Sync failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Register all hotnews and sync tools
 */
export function registerHotNewsTools() {
  // hotnews_get
  toolRegistry.register({
    name: 'hotnews_get',
    description: 'Get today hot news list (今日热榜)',
    parameters: createToolParameter(
      {
        date: {
          type: 'string',
          description: 'Date in YYYY-MM-DD format (optional, defaults to today)',
        },
      },
      []
    ),
    handler: hotnews_get as ToolHandler,
  });

  // sync_trigger
  toolRegistry.register({
    name: 'sync_trigger',
    description: 'Trigger global sync (push and pull)',
    parameters: createToolParameter({}, []),
    handler: sync_trigger as ToolHandler,
  });
}
