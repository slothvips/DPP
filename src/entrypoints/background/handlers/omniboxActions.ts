import { browser } from 'wxt/browser';
import { openLink } from '@/features/links/utils';
import { getJob } from '@/lib/db/jenkins';
import { logger } from '@/utils/logger';
import { searchOmnibox } from './omniboxSearch';

export async function handleOmniboxInputEntered(text: string): Promise<void> {
  let url = text;

  if (!text.startsWith('http://') && !text.startsWith('https://')) {
    const suggestions = await searchOmnibox(text);
    if (suggestions.length > 0) {
      url = suggestions[0].content;
    }
  }

  try {
    const job = await getJob({ jobUrl: url });
    if (job) {
      const popupUrl = browser.runtime.getURL(
        `/sidepanel.html?tab=jenkins&buildJobUrl=${encodeURIComponent(job.url)}&envId=${job.env || ''}`
      );

      browser.windows.create({
        url: popupUrl,
        type: 'popup',
        width: 800,
        height: 600,
      });
      return;
    }
  } catch (error) {
    logger.error('Error checking job for omnibox navigation:', error);
  }

  if (url.startsWith('http://') || url.startsWith('https://')) {
    openLink(url);
  }
}
