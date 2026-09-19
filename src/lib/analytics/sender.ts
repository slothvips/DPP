import { browser } from 'wxt/browser';
import { httpPost } from '@/lib/http';
import { getSyncServerBaseUrl, normalizeSyncServerBaseUrl } from '@/lib/sync/syncServerConfig';
import { logger } from '@/utils/logger';
import { loadOldestEvents, removeEventsUpTo } from './queue';
import type { AnalyticsBatch } from './types';

const STATS_EVENTS_PATH = '/api/stats/events';

/** 单次上报最大事件数 */
export const FLUSH_BATCH_SIZE = 200;

const STORAGE_KEY = 'analytics_instance_id';
const BASE_BACKOFF_MS = 60_000;
const MAX_BACKOFF_MS = 24 * 60 * 60_000;

let cachedInstanceId: string | null = null;
let cachedBrowser: string | null = null;
let nextFlushAllowedAt = 0;
let currentBackoffMs = BASE_BACKOFF_MS;
let flushPromise: Promise<void> | null = null;

/**
 * 匿名实例 ID：随机 UUID，仅存本地，用于 DAU 去重。
 * 不复用同步 clientId，避免与同步数据关联。
 * 任何失败都降级为会话内临时 ID，绝不抛出。
 */
export async function getInstanceId(): Promise<string> {
  if (cachedInstanceId) return cachedInstanceId;
  try {
    const stored = await browser.storage.local.get(STORAGE_KEY);
    const value = (stored as Record<string, unknown>)[STORAGE_KEY];
    if (typeof value === 'string' && value.length > 0) {
      cachedInstanceId = value;
      return value;
    }
    const id = crypto.randomUUID();
    await browser.storage.local.set({ [STORAGE_KEY]: id });
    cachedInstanceId = id;
    return id;
  } catch (error) {
    logger.warn('[Analytics] Failed to persist instance id, using ephemeral id:', error);
    cachedInstanceId ??= crypto.randomUUID();
    return cachedInstanceId;
  }
}

function detectBrowser(): string {
  if (cachedBrowser) return cachedBrowser;
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  cachedBrowser = /firefox/i.test(ua)
    ? 'firefox'
    : /edg/i.test(ua)
      ? 'edge'
      : /chrome|chromium/i.test(ua)
        ? 'chrome'
        : 'other';
  return cachedBrowser;
}

function getExtVersion(): string {
  try {
    return browser.runtime.getManifest().version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

/** 统计上报走团队同步服务器，不写死生产域名。未配置时返回 null，本轮不发送。 */
export function resolveAnalyticsEndpoint(serverUrl: unknown): string | null {
  const baseUrl = normalizeSyncServerBaseUrl(serverUrl);
  return baseUrl ? `${baseUrl}${STATS_EVENTS_PATH}` : null;
}

async function getEndpoint(): Promise<string | null> {
  try {
    const baseUrl = await getSyncServerBaseUrl();
    return resolveAnalyticsEndpoint(baseUrl);
  } catch (error) {
    logger.warn('[Analytics] Failed to resolve stats endpoint:', error);
    return null;
  }
}

function scheduleBackoff(status?: number) {
  nextFlushAllowedAt = Date.now() + currentBackoffMs;
  logger.warn(`[Analytics] Flush failed (status ${status ?? 'network'}), backing off`);
  currentBackoffMs = Math.min(currentBackoffMs * 2, MAX_BACKOFF_MS);
}

/**
 * 将本地队列批量上报到统计端点。
 * 失败时保留队列并指数退避；任何异常都被吞掉，绝不向外抛出。
 */
export function flushAnalytics(): Promise<void> {
  flushPromise ??= doFlush().finally(() => {
    flushPromise = null;
  });
  return flushPromise;
}

async function doFlush(): Promise<void> {
  try {
    if (Date.now() < nextFlushAllowedAt) return;

    const events = await loadOldestEvents(FLUSH_BATCH_SIZE);
    if (events.length === 0) return;

    const batch: AnalyticsBatch = {
      v: 1,
      instanceId: await getInstanceId(),
      extVersion: getExtVersion(),
      browser: detectBrowser(),
      events: events.map(({ id: _id, ...event }) => event),
    };

    const endpoint = await getEndpoint();
    if (!endpoint) {
      logger.debug('[Analytics] Sync server URL not configured, skip flush');
      return;
    }

    try {
      await httpPost(endpoint, batch, { timeout: 15000 });
    } catch (error) {
      const status =
        typeof error === 'object' && error !== null && 'status' in error
          ? Number((error as { status?: unknown }).status)
          : undefined;
      scheduleBackoff(Number.isFinite(status) ? status : undefined);
      return;
    }

    const lastId = events[events.length - 1]?.id;
    if (typeof lastId === 'number') {
      await removeEventsUpTo(lastId);
    }
    currentBackoffMs = BASE_BACKOFF_MS;
  } catch (error) {
    logger.warn('[Analytics] Unexpected flush failure:', error);
  }
}
