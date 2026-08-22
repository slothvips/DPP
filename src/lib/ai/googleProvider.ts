import type { AiSdkProvider } from './aiSdkProvider';
import { resolveContextWindow } from './modelCapabilities';
import type { ChatMessage, ChatOptions, ChatResponse, Model, ModelProvider } from './types';

export class GoogleProvider implements ModelProvider {
  name = 'google';
  baseUrl: string;
  private apiKey: string;
  private _model: string;
  private readonly contextWindow?: number;
  private delegatePromise?: Promise<AiSdkProvider>;

  constructor(baseUrl: string, apiKey: string, model: string, contextWindow?: number) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
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
      apiKey: this.apiKey,
    });
  }

  setModel(model: string): void {
    this._model = model;
    this.delegatePromise = undefined;
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    const delegate = await this.getDelegate();
    return delegate.chat(messages, options);
  }

  async listModels(): Promise<Model[]> {
    return [{ name: this._model }];
  }

  private getDelegate(): Promise<AiSdkProvider> {
    this.delegatePromise ??= Promise.all([
      import('@ai-sdk/google'),
      import('./aiSdkProvider'),
    ]).then(([{ createGoogle }, { AiSdkProvider }]) => {
      const google = createGoogle({ apiKey: this.apiKey, baseURL: this.baseUrl });
      return new AiSdkProvider({
        name: this.name,
        baseUrl: this.baseUrl,
        model: this._model,
        createModel: (modelName) => google(modelName),
      });
    });
    return this.delegatePromise;
  }
}

export function createGoogleProvider(
  baseUrl: string,
  apiKey: string,
  model: string,
  contextWindow?: number
): GoogleProvider {
  return new GoogleProvider(baseUrl, apiKey, model, contextWindow);
}
