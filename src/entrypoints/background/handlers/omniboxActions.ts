import { browser } from 'wxt/browser';
import { isJenkinsFeatureEnabled } from '@/features/jenkins/featureFlags';
import { openLink } from '@/features/links/utils';
import { getJob } from '@/lib/db/jenkins';
import { logger } from '@/utils/logger';
import { searchOmnibox } from './omniboxSearch';
import { parseJenkinsJobContent } from './omniboxShared';

async function openJenkinsWorkbench(envId: string, jobUrl: string): Promise<void> {
  const popupUrl = browser.runtime.getURL(
    `/sidepanel.html?tab=jenkins&buildJobUrl=${encodeURIComponent(jobUrl)}&envId=${encodeURIComponent(envId)}`
  );
  await browser.windows.create({
    url: popupUrl,
    type: 'popup',
    width: 800,
    height: 600,
  });
}

export async function handleOmniboxInputEntered(text: string): Promise<void> {
  let url = text;

  if (!text.startsWith('http://') && !text.startsWith('https://')) {
    const suggestions = await searchOmnibox(text);
    if (suggestions.length > 0) {
      url = suggestions[0].content;
    }
  }

  const scopedJob = parseJenkinsJobContent(url);
  if (scopedJob) {
    if (!(await isJenkinsFeatureEnabled('workbench'))) {
      logger.info('Ignored Jenkins omnibox action because the workbench is disabled');
      return;
    }
    await openJenkinsWorkbench(scopedJob.envId, scopedJob.jobUrl);
    return;
  }

  try {
    const job = await getJob({ jobUrl: url });
    if (job) {
      if (!(await isJenkinsFeatureEnabled('workbench'))) {
        logger.info('Ignored Jenkins omnibox action because the workbench is disabled');
        return;
      }
      await openJenkinsWorkbench(job.env || '', job.url);
      return;
    }
  } catch (error) {
    logger.error('Error checking job for omnibox navigation:', error);
  }

  if (url.startsWith('http://') || url.startsWith('https://')) {
    openLink(url);
  }
}
