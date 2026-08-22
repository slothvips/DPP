import { HttpResponseError } from '@/lib/http';
import { logger } from '@/utils/logger';

const MIN_REQUEST_INTERVAL_MS = 800;
const MAX_RETRIES = 2;
const INITIAL_BACKOFF_MS = 1500;
const MAX_BACKOFF_MS = 15_000;
const MAX_RETRY_AFTER_WAIT_MS = 20_000;

let queue = Promise.resolve();
let nextRequestAt = 0;
let cooldownUntil = 0;

function wait(delay: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(new Error('请求已取消'));
  if (delay <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const finish = () => {
      signal?.removeEventListener('abort', abort);
      resolve();
    };
    const abort = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      reject(new Error('请求已取消'));
    };
    const timer = setTimeout(finish, delay);
    signal?.addEventListener('abort', abort, { once: true });
  });
}

async function waitForSlot(signal?: AbortSignal): Promise<void> {
  const now = Date.now();
  await wait(Math.max(nextRequestAt, cooldownUntil, now) - now, signal);
  nextRequestAt = Date.now() + MIN_REQUEST_INTERVAL_MS;
}

async function reserveSlot(signal?: AbortSignal): Promise<void> {
  let release!: () => void;
  const previous = queue;
  queue = new Promise<void>((resolve) => {
    release = resolve;
  });

  try {
    if (signal) {
      await Promise.race([
        previous,
        new Promise<void>((_, reject) => {
          const abort = () => reject(new Error('请求已取消'));
          signal.addEventListener('abort', abort, { once: true });
          previous.finally(() => signal.removeEventListener('abort', abort)).catch(() => undefined);
        }),
      ]);
    } else {
      await previous;
    }
    await waitForSlot(signal);
  } finally {
    release();
  }
}

function isRetryable(error: unknown): error is HttpResponseError {
  return (
    error instanceof HttpResponseError &&
    (error.status === 408 || error.status === 425 || error.status === 429 || error.status >= 500)
  );
}

async function runWithRateLimit<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  await reserveSlot(signal);
  for (let attempt = 0; ; attempt++) {
    try {
      return await task();
    } catch (error) {
      if (!isRetryable(error) || attempt >= MAX_RETRIES || signal?.aborted) {
        throw error;
      }
      if (error.retryAfterMs !== undefined && error.retryAfterMs > MAX_RETRY_AFTER_WAIT_MS) {
        throw error;
      }
      const retryDelay = Math.max(
        error.retryAfterMs ?? 0,
        Math.min(MAX_BACKOFF_MS, INITIAL_BACKOFF_MS * 2 ** attempt)
      );
      cooldownUntil = Math.max(cooldownUntil, Date.now() + retryDelay);
      logger.warn(`[OpenCode] Upstream returned ${error.status}; retrying in ${retryDelay}ms`);
      await wait(retryDelay, signal);
      await reserveSlot(signal);
    }
  }
}

export function executeOpenCodeRateLimited<T>(
  task: () => Promise<T>,
  signal?: AbortSignal
): Promise<T> {
  return runWithRateLimit(task, signal);
}
