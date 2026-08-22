import { executeAnthropicChat } from './anthropicProviderChat';
import { listKnownAnthropicModels } from './anthropicProviderModels';
import type { ChatMessage, ChatOptions, ChatResponse, Model, ModelProvider } from './types';

export class AnthropicProvider implements ModelProvider {
  name = 'anthropic';
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

  setModel(model: string): void {
    this._model = model;
  }

  getContextWindow(): Promise<number | undefined> {
    return Promise.resolve(this.contextWindow);
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    return executeAnthropicChat({
      baseUrl: this.baseUrl,
      apiKey: this.apiKey,
      model: this._model,
      messages,
      options,
    });
  }

  async listModels(): Promise<Model[]> {
    return listKnownAnthropicModels();
  }
}
