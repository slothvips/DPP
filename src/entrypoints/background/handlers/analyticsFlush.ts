import { browser } from 'wxt/browser';
import { persistAndFlushAnalytics } from '@/lib/analytics/tracker';
import { logger } from '@/utils/logger';

export const ANALYTICS_FLUSH_ALARM = 'analytics-flush';

/**
 * 注册匿名统计队列的定时上报。侧栏只把事件落本地队列，真正 POST 只走这里，
 * 避免 sidepanel 与 service worker 对同一批事件重复上报。
 * 独立 alarm 名称，不触碰现有 auto-sync / push-retry 调度。
 * persistAndFlushAnalytics 内部已吞掉所有异常，这里仅做防御性兜底。
 */
export function setupAnalyticsFlush(): void {
  if (browser.alarms) {
    browser.alarms
      .create(ANALYTICS_FLUSH_ALARM, { periodInMinutes: 5 })
      .catch((error: unknown) => logger.warn('[Analytics] Failed to create flush alarm:', error));
  }

  browser.alarms?.onAlarm.addListener((alarm) => {
    if (alarm.name !== ANALYTICS_FLUSH_ALARM) return;
    persistAndFlushAnalytics().catch((error: unknown) => {
      logger.warn('[Analytics] Flush alarm handler failed:', error);
    });
  });

  persistAndFlushAnalytics().catch((error: unknown) => {
    logger.warn('[Analytics] Startup flush failed:', error);
  });
}
