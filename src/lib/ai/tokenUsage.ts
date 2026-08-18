import type { TokenUsage } from './types';

interface CreateTokenUsageOptions {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cachedInputTokens?: number;
  cacheWriteInputTokens?: number;
}

export function createTokenUsage({
  inputTokens,
  outputTokens,
  totalTokens,
  cachedInputTokens,
  cacheWriteInputTokens,
}: CreateTokenUsageOptions): TokenUsage | undefined {
  if (inputTokens === undefined && outputTokens === undefined && totalTokens === undefined) {
    return undefined;
  }

  const normalizedInputTokens = inputTokens ?? 0;
  const normalizedOutputTokens = outputTokens ?? 0;

  return {
    inputTokens: normalizedInputTokens,
    outputTokens: normalizedOutputTokens,
    totalTokens: totalTokens ?? normalizedInputTokens + normalizedOutputTokens,
    cachedInputTokens,
    cacheWriteInputTokens,
  };
}
