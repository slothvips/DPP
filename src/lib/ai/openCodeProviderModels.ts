import { HttpResponseError, extractHttpErrorMessage, http, httpPost } from '@/lib/http';
import { logger } from '@/utils/logger';
import {
  createOpenCodeRequestId,
  createOpenCodeRequestIdentity,
  getOpenCodeHeaders,
  getOpenCodeModelHeaders,
  isOpenCodeFreeModel,
} from './openCodeProviderShared';
import type { Model } from './types';

const MODEL_CACHE_TTL_MS = 60_000;
const STALE_MODEL_CACHE_TTL_MS = 5 * 60_000;
const AVAILABILITY_CACHE_TTL_MS = 5 * 60_000;
const MODEL_PROBE_INTERVAL_MS = 800;

interface ModelCacheEntry {
  cachedAt: number;
  expiresAt: number;
  models: Model[];
}

const modelCache = new Map<string, ModelCacheEntry>();
const availabilityCache = new Map<string, { expiresAt: number; model: Model }>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readContextWindow(item: Record<string, unknown>): number | undefined {
  const limit = isRecord(item.limit) ? item.limit : undefined;
  const limits = isRecord(item.limits) ? item.limits : undefined;
  const candidates = [limit?.context, limits?.context, item.context_window, item.contextWindow];
  return candidates.find(
    (value): value is number => typeof value === 'number' && Number.isInteger(value) && value > 0
  );
}

function extractModels(value: unknown): Model[] {
  if (!isRecord(value) || !Array.isArray(value.data)) {
    throw new Error('OpenCode model response has an invalid format');
  }
  return value.data.flatMap((item): Model[] => {
    if (!isRecord(item) || typeof item.id !== 'string' || !isOpenCodeFreeModel(item.id)) {
      return [];
    }
    return [{ name: item.id, contextWindow: readContextWindow(item) }];
  });
}

export async function listOpenCodeModels(baseUrl: string, apiKey?: string): Promise<Model[]> {
  const cacheKey = `${baseUrl}\u0000${apiKey || 'public'}`;
  const cached = modelCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.models;
  }

  try {
    const response = await http(`${baseUrl.replace(/\/$/, '')}/models`, {
      timeout: 10_000,
      headers: getOpenCodeModelHeaders(apiKey),
    });
    if (!response.ok) {
      const retryAfter = response.headers.get('Retry-After');
      const details = extractHttpErrorMessage(await response.text());
      throw new Error(
        `OpenCode 模型接口返回 ${response.status}` +
          (retryAfter ? `（Retry-After: ${retryAfter} 秒）` : '') +
          (details ? ` - ${details}` : '')
      );
    }
    const models = extractModels(await response.json());
    if (models.length === 0) {
      throw new Error('OpenCode returned no free models');
    }
    const cachedAt = Date.now();
    modelCache.set(cacheKey, { cachedAt, expiresAt: cachedAt + MODEL_CACHE_TTL_MS, models });
    return models;
  } catch (error) {
    logger.error('[OpenCode] List free models failed:', error);
    if (cached && Date.now() - cached.cachedAt <= STALE_MODEL_CACHE_TTL_MS) {
      return cached.models;
    }
    throw new Error(
      `OpenCode model API error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function wait(delay: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delay));
}

function getAvailabilityCacheKey(baseUrl: string, apiKey: string, model: string): string {
  return `${baseUrl}:${apiKey}:${model}`;
}

async function probeOpenCodeModel(
  baseUrl: string,
  apiKey: string,
  model: Model,
  identity: ReturnType<typeof createOpenCodeRequestIdentity>
): Promise<Model> {
  const cacheKey = getAvailabilityCacheKey(baseUrl, apiKey, model.name);
  const cached = availabilityCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.model;
  }

  try {
    await httpPost<unknown>(
      `${baseUrl.replace(/\/$/, '')}/chat/completions`,
      {
        model: model.name,
        messages: [{ role: 'user', content: 'Reply with OK.' }],
        stream: false,
        max_tokens: 1,
      },
      {
        timeout: 12_000,
        headers: getOpenCodeHeaders(identity, createOpenCodeRequestId(), { apiKey }),
      }
    );
    const result = { ...model, availability: 'available' as const, availabilityError: undefined };
    availabilityCache.set(cacheKey, {
      expiresAt: Date.now() + AVAILABILITY_CACHE_TTL_MS,
      model: result,
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const result = {
      ...model,
      availability: 'unavailable' as const,
      availabilityError: message,
    };
    availabilityCache.set(cacheKey, {
      expiresAt: Date.now() + AVAILABILITY_CACHE_TTL_MS,
      model: result,
    });
    if (error instanceof HttpResponseError && error.status === 429) {
      logger.warn(`[OpenCode] Model probe rate limited: ${model.name}`);
    } else {
      logger.debug(`[OpenCode] Model probe failed: ${model.name}`, error);
    }
    return result;
  }
}

export async function checkOpenCodeModels(
  baseUrl: string,
  models: Model[],
  apiKey = ''
): Promise<Model[]> {
  const identity = createOpenCodeRequestIdentity();
  const results: Model[] = [];
  for (const model of models) {
    if (results.length > 0) {
      await wait(MODEL_PROBE_INTERVAL_MS);
    }
    results.push(await probeOpenCodeModel(baseUrl, apiKey, model, identity));
  }
  return results;
}
