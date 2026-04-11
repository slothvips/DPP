import { executeOpenAIChat } from './openaiProviderChat';
import { listOpenAIModels } from './openaiProviderModels';
import type { ChatMessage, ChatOptions, ChatResponse, Model, ModelProvider } from './types';

export class OpenAICompatibleProvider implements ModelProvider {
  name = 'custom';
  baseUrl: string;
  apiKey: string;
  private _model: string;

  constructor(baseUrl: string, apiKey: string, model: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this._model = model;
  }

  getModelName(): string {
    return this._model;
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
