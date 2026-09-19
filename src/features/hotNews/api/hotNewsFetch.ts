import { HOT_NEWS } from '@/config/constants';
import type { DailyNews } from '@/features/hotNews/types';
import { trackHotnews } from '@/lib/analytics';
import { cleanupOldHotNews, getHotNews, saveHotNews } from '@/lib/db/hotnews';
import { http } from '@/lib/http';
import { logger } from '@/utils/logger';
import { getAvailableDates, getBeijingDate } from './hotNewsDates';
import { parseHotNewsMarkdown } from './hotNewsParser';

async function cleanupOldNews() {
  const validDates = new Set(getAvailableDates().map((date) => date.value));
  await cleanupOldHotNews(validDates);
}

interface FetchNewsOptions {
  trigger?: 'manual' | 'retry' | 'empty' | 'auto' | 'preview';
}

export async function fetchNews(
  date: string,
  options: FetchNewsOptions = {}
): Promise<DailyNews | null> {
  try {
    const cached = await getHotNews({ date });
    if (cached?.data) {
      return cached.data;
    }
  } catch (error) {
    logger.debug('Cache read failed:', error);
  }

  const url = `${HOT_NEWS.API_BASE_URL}/daily_hot_${date}.md`;

  try {
    const response = await http(url, {
      timeout: 15000,
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch news: ${response.status} ${response.statusText}`);
    }

    const markdown = await response.text();
    const data = parseHotNewsMarkdown(markdown, date);

    try {
      await saveHotNews({ date, data });
      void cleanupOldNews();
    } catch (error) {
      logger.debug('Cache write failed:', error);
    }

    if (options.trigger) {
      trackHotnews('feedRefreshed', { meta: { trigger: options.trigger } });
    }

    return data;
  } catch (error) {
    if (error instanceof Error && error.message.includes('超时')) {
      return null;
    }

    throw error;
  }
}

export async function fetchTodayNews(): Promise<DailyNews | null> {
  return fetchNews(getBeijingDate(0));
}

/** 打开热榜条目的埋点入口：热榜页与快捷预览都走这里。 */
export function reportHotNewsArticleOpened(source: string): void {
  trackHotnews('articleOpened', { meta: { source } });
}
