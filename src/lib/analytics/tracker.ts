import { logger } from '@/utils/logger';
import { enqueueEvents } from './queue';
import { flushAnalytics } from './sender';
import type { AnalyticsEvent, AnalyticsMeta, QueuedAnalyticsEvent } from './types';

/** 内存 buffer 上限，溢出丢弃最新事件（只丢统计） */
const BUFFER_LIMIT = 200;

const ACTION_PATTERN = /^[a-z][a-zA-Z0-9_]*$/;
const MODULE_PATTERN = /^[a-z][a-zA-Z0-9_]*$/;
const META_VALUE_MAX_LENGTH = 64;

let buffer: QueuedAnalyticsEvent[] = [];
let disabled = false;
let persistScheduled = false;
let persistInFlight = false;
let lifecycleBound = false;

function sanitizeMeta(meta: AnalyticsMeta | undefined): AnalyticsMeta | undefined {
  if (!meta) return undefined;
  const entries = Object.entries(meta).filter(
    ([key, value]) =>
      key.length > 0 &&
      key.length <= 64 &&
      (typeof value === 'string'
        ? value.length <= META_VALUE_MAX_LENGTH
        : typeof value === 'number'
          ? Number.isFinite(value)
          : typeof value === 'boolean')
  );
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function isValidEvent(event: AnalyticsEvent): boolean {
  return (
    typeof event.module === 'string' &&
    MODULE_PATTERN.test(event.module) &&
    typeof event.action === 'string' &&
    ACTION_PATTERN.test(event.action) &&
    (event.value === undefined || (typeof event.value === 'number' && Number.isFinite(event.value)))
  );
}

function disableAnalytics(reason: unknown) {
  disabled = true;
  buffer = [];
  logger.warn('[Analytics] Disabled for this session:', reason);
}

function bindLifecycleFlush() {
  if (lifecycleBound) return;
  lifecycleBound = true;
  if (typeof document === 'undefined') return;

  const drain = () => {
    void persistBuffer();
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') drain();
  });
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', drain);
  }
}

function schedulePersist() {
  if (persistScheduled || disabled) return;
  persistScheduled = true;
  // 用 microtask 而不是 setTimeout：MV3 service worker 里 timer 不可靠，
  // 同一轮事件循环内的多次 track 仍会合并成一次落库。
  void Promise.resolve().then(() => {
    persistScheduled = false;
    void persistBuffer();
  });
}

async function persistBuffer() {
  if (disabled || persistInFlight) return;
  if (buffer.length === 0) return;

  persistInFlight = true;
  const events = buffer;
  buffer = [];
  let succeeded = false;
  try {
    await enqueueEvents(events);
    succeeded = true;
  } catch (error) {
    // 落库失败时把事件放回队列，下一次 track 再试；只丢统计，不影响业务
    buffer = events.concat(buffer).slice(0, BUFFER_LIMIT);
    logger.warn('[Analytics] Failed to persist events:', error);
  } finally {
    persistInFlight = false;
    if (succeeded && buffer.length > 0) schedulePersist();
  }
}

/**
 * 把当前上下文内存中的事件落库并尝试上报。
 * 仅供 background 定时器 / 启动时调用：侧栏只 persist，避免与 SW 重复 POST。
 */
export async function persistAndFlushAnalytics(): Promise<void> {
  await persistBuffer();
  await flushAnalytics();
}

/**
 * 埋点入口：同步、永不抛出、永不阻塞。
 * 任何一环失败都会静默禁用当会话的埋点（见零影响硬约束）。
 */
export function trackEvent(event: AnalyticsEvent): void {
  if (disabled) return;
  try {
    bindLifecycleFlush();
    if (import.meta.env.DEV) {
      logger.debug('[Analytics]', event);
    }
    if (!isValidEvent(event)) return;

    if (buffer.length >= BUFFER_LIMIT) return;

    buffer.push({ ...event, meta: sanitizeMeta(event.meta), ts: Date.now() });
    schedulePersist();
  } catch (error) {
    disableAnalytics(error);
  }
}
