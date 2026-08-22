import { http } from '@/lib/http';
import { logger } from '@/utils/logger';

interface ModelCapabilityOptions {
  provider: string;
  baseUrl: string;
  model: string;
  apiKey?: string;
}

interface CachedContextWindow {
  value: number | undefined;
  expiresAt: number;
}

interface GoogleModelResponse {
  inputTokenLimit?: number;
}

const CONTEXT_WINDOW_CACHE_TTL = 24 * 60 * 60 * 1000;
const FAILED_LOOKUP_CACHE_TTL = 10 * 60 * 1000;
const contextWindowCache = new Map<string, CachedContextWindow>();

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

function getCacheKey({ provider, baseUrl, model }: ModelCapabilityOptions): string {
  return `${provider}:${normalizeBaseUrl(baseUrl)}:${model}`;
}

async function fetchGoogleContextWindow({
  baseUrl,
  model,
  apiKey,
}: ModelCapabilityOptions): Promise<number | undefined> {
  if (!apiKey) {
    return undefined;
  }

  const modelId = model.replace(/^models\//, '');
  const url = `${normalizeBaseUrl(baseUrl)}/models/${encodeURIComponent(modelId)}`;
  const response = await http(url, {
    timeout: 5000,
    headers: { 'x-goog-api-key': apiKey },
  });
  if (!response.ok) {
    return undefined;
  }

  const data = (await response.json()) as GoogleModelResponse;
  return data.inputTokenLimit;
}

async function fetchContextWindow(options: ModelCapabilityOptions): Promise<number | undefined> {
  switch (options.provider) {
    case 'google':
      return fetchGoogleContextWindow(options);
    default:
      return undefined;
  }
}

export async function resolveContextWindow(
  options: ModelCapabilityOptions
): Promise<number | undefined> {
  const cacheKey = getCacheKey(options);
  const cached = contextWindowCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  try {
    const value = await fetchContextWindow(options);
    contextWindowCache.set(cacheKey, {
      value,
      expiresAt: Date.now() + (value ? CONTEXT_WINDOW_CACHE_TTL : FAILED_LOOKUP_CACHE_TTL),
    });
    return value;
  } catch (error) {
    logger.debug('[AI] Model context lookup failed:', error);
    contextWindowCache.set(cacheKey, {
      value: undefined,
      expiresAt: Date.now() + FAILED_LOOKUP_CACHE_TTL,
    });
    return undefined;
  }
}
