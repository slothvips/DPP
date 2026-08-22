// Ollama model provider implementation
import { http } from '@/lib/http';
import { resolveContextWindow } from './modelCapabilities';
import { executeOllamaChat } from './ollamaChat';
import { listOllamaModels } from './ollamaModels';
import { DEFAULT_OLLAMA_BASE_URL, DEFAULT_OLLAMA_MODEL } from './ollamaShared';
import type { ChatMessage, ChatOptions, ChatResponse, Model, ModelProvider } from './types';

export {
  DEFAULT_OLLAMA_BASE_URL,
  DEFAULT_OLLAMA_MODEL,
  stripThinkingContent,
} from './ollamaShared';

export class OllamaProvider implements ModelProvider {
  name = 'ollama';
  baseUrl: string;
  private _model: string;
  private readonly contextWindow?: number;

  constructor(
    baseUrl: string = DEFAULT_OLLAMA_BASE_URL,
    model: string = DEFAULT_OLLAMA_MODEL,
    contextWindow?: number
  ) {
    this.baseUrl = baseUrl;
    this._model = model;
    this.contextWindow = contextWindow;
  }

  getModelName(): string {
    return this._model;
  }

  getContextWindow(): Promise<number | undefined> {
    if (this.contextWindow !== undefined) return Promise.resolve(this.contextWindow);
    return resolveContextWindow({
      provider: this.name,
      baseUrl: this.baseUrl,
      model: this._model,
    });
  }

  setModel(model: string): void {
    this._model = model;
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    return executeOllamaChat({
      baseUrl: this.baseUrl,
      model: this._model,
      messages,
      options,
    });
  }

  async listModels(): Promise<Model[]> {
    return listOllamaModels(this.baseUrl);
  }

  async healthCheck(): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/api/tags`;
      const response = await http(url, { timeout: 5000 });
      return response.ok;
    } catch (error) {
      logger.debug('Ollama health check failed:', error);
      return false;
    }
  }
}

export function createOllamaProvider(
  baseUrl: string = DEFAULT_OLLAMA_BASE_URL,
  model: string = DEFAULT_OLLAMA_MODEL
): OllamaProvider {
  return new OllamaProvider(baseUrl, model);
}
