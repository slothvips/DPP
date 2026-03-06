import { HOT_NEWS } from '@/config/constants';
import type { DailyNews, NewsSection } from '@/features/hotNews/types';
import { cleanupOldHotNews, getHotNews, saveHotNews } from '@/lib/db/hotnews';
import { http } from '@/lib/http';
import { logger } from '@/utils/logger';

/**
 * Get Beijing date string accounting for timezone differences
 * Correctly handles users in different timezones
 *
 * @param offsetDays - Number of days to offset (0 = today, 1 = yesterday, etc.)
 * @returns Date string in YYYY-MM-DD format
 */
function getBejingDate(offsetDays = 0): string {
  const now = new Date();

  // Beijing timezone is UTC+8
  const bjOffset = 8 * 60 * 60 * 1000;

  // Calculate Beijing time from UTC
  // We only need to add the Beijing offset to the UTC timestamp
  // Using getUTC* methods on the result will give us Beijing date components
  const bjTime = new Date(now.getTime() + bjOffset - offsetDays * 24 * 60 * 60 * 1000);

  // Format as YYYY-MM-DD
  const year = bjTime.getUTCFullYear();
  const month = String(bjTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(bjTime.getUTCDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function getAvailableDates(): { label: string; value: string }[] {
  return [
    { label: '今天', value: getBejingDate(0) },
    { label: '昨天', value: getBejingDate(1) },
    { label: '前天', value: getBejingDate(2) },
  ];
}

async function cleanupOldNews() {
  const validDates = new Set(getAvailableDates().map((d) => d.value));
  await cleanupOldHotNews(validDates);
}

function extractIconAndText(header: string): { icon: string; text: string } {
  const emojiMatch = header.match(/[\u{1F300}-\u{1F9FF}]/u);
  const icon = emojiMatch ? emojiMatch[0] : '📰';
  const text = header.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
  return { icon, text };
}

function parseMarkdown(markdown: string, date: string): DailyNews {
  const sections: NewsSection[] = [];
  const lines = markdown.split('\n');
  let currentSection: NewsSection | null = null;

  const sectionRegex = /^##\s+(.+)$/;
  const linkRegex = /^\d+\.\s+\[(.+?)\]\((.+?)\)/;
  const commentRegex = /^\s*>\s+(.*)$/;

  for (const line of lines) {
    const sectionMatch = line.match(sectionRegex);
    if (sectionMatch) {
      if (currentSection && currentSection.items.length > 0) {
        sections.push(currentSection);
      }
      const headerText = sectionMatch[1].trim();
      const { icon, text } = extractIconAndText(headerText);
      currentSection = {
        source: text,
        icon,
        items: [],
      };
      continue;
    }

    if (!currentSection) continue;

    const linkMatch = line.match(linkRegex);
    if (linkMatch) {
      currentSection.items.push({
        title: linkMatch[1],
        url: linkMatch[2],
        comment: '',
      });
      continue;
    }

    const commentMatch = line.match(commentRegex);
    if (commentMatch && currentSection.items.length > 0) {
      const lastItem = currentSection.items[currentSection.items.length - 1];
      if (lastItem.comment) {
        lastItem.comment += ` ${commentMatch[1].trim()}`;
      } else {
        lastItem.comment = commentMatch[1].trim();
      }
    }
  }

  if (currentSection && currentSection.items.length > 0) {
    sections.push(currentSection);
  }

  return { date, sections };
}

export async function fetchNews(date: string): Promise<DailyNews | null> {
  // Try cache first
  try {
    const cached = await getHotNews({ date });
    if (cached?.data) {
      return cached.data as DailyNews;
    }
  } catch (error) {
    logger.debug('Cache read failed:', error);
  }

  const url = `${HOT_NEWS.API_BASE_URL}/daily_hot_${date}.md`;

  try {
    const response = await http(url, {
      timeout: 15000, // 15s timeout for markdown files
    });

    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`Failed to fetch news: ${response.status} ${response.statusText}`);
    }

    const markdown = await response.text();
    const data = parseMarkdown(markdown, date);

    // Save to cache and cleanup
    try {
      await saveHotNews({ date, data });
      cleanupOldNews();
    } catch (error) {
      logger.debug('Cache write failed:', error);
    }

    return data;
  } catch (error) {
    // If network request fails, return null (no data available)
    if (error instanceof Error && error.message.includes('超时')) {
      // Timeout error from http client
      return null;
    }
    throw error;
  }
}

export async function fetchTodayNews(): Promise<DailyNews | null> {
  return fetchNews(getBejingDate(0));
}
