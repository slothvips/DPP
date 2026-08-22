import { logger } from '@/utils/logger';

/**
 * HTTP client options with timeout and retry support
 */
export interface HttpOptions extends RequestInit {
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Number of retry attempts (default: 0) */
  retries?: number;
  /** Delay between retries in milliseconds (default: 1000) */
  retryDelay?: number;
  /** Whether to log request details (default: false) */
  debug?: boolean;
}

export class HttpResponseError extends Error {
  readonly status: number;
  readonly retryAfterMs?: number;
  readonly details?: string;

  constructor(response: Response, details?: string) {
    const retryAfterMs = parseRetryAfter(response.headers.get('Retry-After'));
    const retryHint = retryAfterMs
      ? `（请在 ${Math.max(1, Math.round(retryAfterMs / 1000))} 秒后重试）`
      : '';
    super(
      `HTTP ${response.status}: ${response.statusText}${details ? ` - ${details}` : ''}${retryHint}`
    );
    this.name = 'HttpResponseError';
    this.status = response.status;
    this.retryAfterMs = retryAfterMs;
    this.details = details;
  }
}

export function extractHttpErrorMessage(bodyText: string): string | undefined {
  if (!bodyText) return undefined;
  try {
    const parsed = JSON.parse(bodyText) as unknown;
    if (typeof parsed === 'object' && parsed !== null) {
      const record = parsed as Record<string, unknown>;
      const error =
        typeof record.error === 'object' && record.error !== null
          ? (record.error as Record<string, unknown>)
          : undefined;
      const message = error?.message ?? record.message;
      if (typeof message === 'string' && message.trim()) return message.trim().slice(0, 300);
    }
  } catch {
    // Fall back to the raw response body.
  }
  const text = bodyText.trim().slice(0, 300);
  return text || undefined;
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? undefined : Math.max(0, timestamp - Date.now());
}

/**
 * Enhanced fetch with timeout and retry support
 *
 * @param url - The URL to fetch
 * @param options - HTTP options including timeout and retry configuration
 * @returns Promise resolving to Response
 * @throws Error if request fails after all retries
 *
 * @example
 * ```typescript
 * const response = await http('https://api.example.com/data', {
 *   timeout: 10000,
 *   retries: 2,
 *   headers: { 'Authorization': 'Bearer token' }
 * });
 * ```
 */
export async function http(url: string, options: HttpOptions = {}): Promise<Response> {
  const {
    timeout = 30000,
    retries = 0,
    retryDelay = 1000,
    debug = false,
    ...fetchOptions
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      if (debug) {
        logger.debug(
          `[HTTP] ${fetchOptions.method || 'GET'} ${url} (attempt ${attempt + 1}/${retries + 1})`
        );
      }

      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (debug) {
        logger.debug(`[HTTP] ${url} responded with status ${response.status}`);
      }

      return response;
    } catch (e) {
      clearTimeout(timeoutId);

      if (e instanceof Error && e.name === 'AbortError') {
        lastError = new Error(`请求超时 (${timeout}ms): ${url}`);
      } else {
        lastError = e instanceof Error ? e : new Error(String(e));
      }

      // Log error if it's the last attempt or debug mode
      if (attempt === retries || debug) {
        logger.error(
          `[HTTP] Request failed (attempt ${attempt + 1}/${retries + 1}):`,
          lastError.message
        );
      }

      // Retry with exponential backoff if not the last attempt
      if (attempt < retries) {
        const delay = retryDelay * 2 ** attempt; // Exponential backoff
        if (debug) {
          logger.debug(`[HTTP] Retrying in ${delay}ms...`);
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError ?? new Error(`HTTP request failed: ${url}`);
}

/**
 * HTTP POST request with automatic JSON handling
 *
 * @param url - The URL to post to
 * @param data - Data to send (will be JSON stringified)
 * @param options - HTTP options
 * @returns Promise resolving to Response
 */
export async function httpPost<T = unknown>(
  url: string,
  data?: unknown,
  options: HttpOptions = {}
): Promise<T> {
  const response = await http(url, {
    ...options,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: data ? JSON.stringify(data) : undefined,
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new HttpResponseError(response, extractHttpErrorMessage(bodyText));
  }

  return response.json() as Promise<T>;
}
