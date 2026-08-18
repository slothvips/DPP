import { http } from '@/lib/http';
import { logger } from '@/utils/logger';
import { getOpenAIHeaders } from './openaiProviderShared';

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

interface OllamaShowResponse {
  model_info?: Record<string, unknown>;
}

interface GoogleModelResponse {
  inputTokenLimit?: number;
}

interface OpenRouterModel {
  id?: string;
  context_length?: number | null;
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

function findOllamaContextWindow(modelInfo: Record<string, unknown>): number | undefined {
  const entry = Object.entries(modelInfo).find(
    ([key, value]) => key.endsWith('.context_length') && typeof value === 'number'
  );
  return typeof entry?.[1] === 'number' ? entry[1] : undefined;
}

async function fetchOllamaContextWindow({
  baseUrl,
  model,
}: ModelCapabilityOptions): Promise<number | undefined> {
  const response = await http(`${normalizeBaseUrl(baseUrl)}/api/show`, {
    method: 'POST',
    timeout: 5000,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model }),
  });
  if (!response.ok) {
    return undefined;
  }

  const data = (await response.json()) as OllamaShowResponse;
  return data.model_info ? findOllamaContextWindow(data.model_info) : undefined;
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

async function fetchOpenRouterContextWindow({
  baseUrl,
  model,
  apiKey,
}: ModelCapabilityOptions): Promise<number | undefined> {
  const response = await http(`${normalizeBaseUrl(baseUrl)}/models`, {
    timeout: 5000,
    headers: getOpenAIHeaders(apiKey || ''),
  });
  if (!response.ok) {
    return undefined;
  }

  const data = (await response.json()) as { data?: OpenRouterModel[] };
  const modelData = data.data?.find((candidate) => candidate.id === model);
  return modelData?.context_length ?? undefined;
}

async function fetchContextWindow(options: ModelCapabilityOptions): Promise<number | undefined> {
  switch (options.provider) {
    case 'ollama':
      return fetchOllamaContextWindow(options);
    case 'google':
      return fetchGoogleContextWindow(options);
    case 'openrouter':
      return fetchOpenRouterContextWindow(options);
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
