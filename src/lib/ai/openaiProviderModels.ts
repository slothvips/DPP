import { http } from '@/lib/http';
import { logger } from '@/utils/logger';
import { getOpenAIHeaders } from './openaiProviderShared';
import type { Model } from './types';

export async function listOpenAIModels(baseUrl: string, apiKey: string): Promise<Model[]> {
  const url = `${baseUrl}/models`;

  logger.debug(`[OpenAI] Listing models from ${url}`);

  try {
    const response = await http(url, {
      timeout: 10000,
      headers: getOpenAIHeaders(apiKey),
    });

    if (!response.ok) {
      throw new Error(`Failed to list models: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as { data: { id: string }[] };
    return data.data.map((model) => ({ name: model.id }));
  } catch (error) {
    logger.error('[OpenAI] List models failed:', error);
    throw new Error(`OpenAI API error: ${error instanceof Error ? error.message : String(error)}`);
  }
}
