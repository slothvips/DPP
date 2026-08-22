import { resolveContextWindow } from './modelCapabilities';
import { executeOpenAIChat } from './openaiProviderChat';
import { listOpenAIModels } from './openaiProviderModels';
import type { ChatMessage, ChatOptions, ChatResponse, Model, ModelProvider } from './types';

export class OpenAICompatibleProvider implements ModelProvider {
  name = 'custom';
  baseUrl: string;
  apiKey: string;
  private _model: string;
  private readonly contextWindow?: number;

  constructor(baseUrl: string, apiKey: string, model: string, contextWindow?: number) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this._model = model;
    this.contextWindow = contextWindow;
  }

  getModelName(): string {
    return this._model;
  }

  async getContextWindow(): Promise<number | undefined> {
    if (this.contextWindow !== undefined) return this.contextWindow;
    try {
      const models = await this.listModels();
      const model = models.find((item) => item.name === this._model);
      if (model?.contextWindow !== undefined) return model.contextWindow;
    } catch {
      // Fall back to provider-specific capability lookup below.
    }
    return resolveContextWindow({
      provider: this.name,
      baseUrl: this.baseUrl,
      model: this._model,
      apiKey: this.apiKey,
    });
  }

  setModel(model: string): void {
    this._model = model;
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    return executeOpenAIChat({
      baseUrl: this.baseUrl,
      apiKey: this.apiKey,
      model: this._model,
      messages,
      options,
    });
  }

  async listModels(): Promise<Model[]> {
    return listOpenAIModels(this.baseUrl, this.apiKey);
  }
}
