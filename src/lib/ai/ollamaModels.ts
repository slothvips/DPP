import { http } from '@/lib/http';
import { logger } from '@/utils/logger';
import type { Model } from './types';

export async function listOllamaModels(baseUrl: string): Promise<Model[]> {
  const url = `${baseUrl}/api/tags`;

  logger.debug(`[Ollama] Listing models from ${url}`);

  try {
    const response = await http(url, { timeout: 10000 });
    if (!response.ok) {
      throw new Error(`Failed to list models: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as { models: Model[] };
    return data.models;
  } catch (error) {
    logger.error('[Ollama] List models failed:', error);
    throw new Error(`Ollama API error: ${error instanceof Error ? error.message : String(error)}`);
  }
}
