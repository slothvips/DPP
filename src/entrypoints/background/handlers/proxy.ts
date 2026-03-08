// Zen and API proxy handlers for background script
import { logger } from '@/utils/logger';

export type ProxyMessage =
  | { type: 'ZEN_FETCH_JSON'; payload: { url: string } }
  | {
      type: 'JENKINS_API_REQUEST';
      payload: {
        url: string;
        options?: {
          method?: string;
          headers?: Record<string, string>;
          body?: string;
          timeout?: number;
        };
      };
    };

/**
 * Handle Zen fetch JSON proxy
 */
export async function handleZenFetchJson(
  url: string
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    const response = await fetch(url, { credentials: 'include' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    return { success: true, data };
  } catch (e) {
    logger.error('ZEN_FETCH_JSON failed:', e);
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Handle Jenkins API request proxy
 */
export async function handleJenkinsApiRequest(
  url: string,
  options?: { method?: string; headers?: Record<string, string>; body?: string; timeout?: number }
): Promise<{ success: boolean; status?: number; data?: unknown; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options?.timeout || 30000);

    const response = await fetch(url, {
      method: options?.method || 'GET',
      headers: options?.headers,
      body: options?.body,
      signal: controller.signal,
      credentials: 'include',
    });

    clearTimeout(timeoutId);

    const data = await response.json();
    return { success: true, status: response.status, data };
  } catch (e) {
    logger.error('JENKINS_API_REQUEST failed:', e);
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Handle proxy messages
 */
export async function handleProxyMessage(
  message: ProxyMessage
): Promise<{ success: boolean; data?: unknown; status?: number; error?: string }> {
  switch (message.type) {
    case 'ZEN_FETCH_JSON':
      return handleZenFetchJson(message.payload.url);

    case 'JENKINS_API_REQUEST':
      return handleJenkinsApiRequest(message.payload.url, message.payload.options);

    default:
      return { success: false, error: 'Unknown proxy message type' };
  }
}
