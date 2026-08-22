import { logger } from '@/utils/logger';
import { listOpenCodeModels } from './openCodeProviderModels';
import {
  createOpenCodeRequestId,
  createOpenCodeRequestIdentity,
  deriveOpenCodeSessionId,
  getOpenCodeHeaders,
  normalizeOpenCodeModel,
} from './openCodeProviderShared';
import { executeOpenCodeRateLimited } from './openCodeRateLimit';
import { executeOpenAIChat } from './openaiProviderChat';
import type { ChatMessage, ChatOptions, ChatResponse, Model, ModelProvider } from './types';

export class OpenCodeProvider implements ModelProvider {
  name = 'opencode';
  baseUrl: string;
  private readonly apiKey: string;
  private readonly identity = createOpenCodeRequestIdentity();
  private _model: string;
  private readonly contextWindow?: number;

  constructor(baseUrl: string, apiKey: string, model: string, contextWindow?: number) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this._model = normalizeOpenCodeModel(model);
    this.contextWindow = contextWindow;
  }

  getModelName(): string {
    return this._model;
  }

  async getContextWindow(): Promise<number | undefined> {
    if (this.contextWindow !== undefined) return this.contextWindow;
    try {
      const models = await listOpenCodeModels(this.baseUrl, this.apiKey);
      return models.find((model) => model.name === this._model)?.contextWindow;
    } catch (error) {
      logger.debug('[OpenCode] Context window lookup failed:', error);
      return undefined;
    }
  }

  setModel(model: string): void {
    this._model = normalizeOpenCodeModel(model);
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    const session = (await deriveOpenCodeSessionId(messages)) ?? this.identity.session;
    const headers = getOpenCodeHeaders({ ...this.identity, session }, createOpenCodeRequestId(), {
      stream: Boolean(options?.stream),
      apiKey: this.apiKey,
    });
    return executeOpenCodeRateLimited(
      () =>
        executeOpenAIChat({
          baseUrl: this.baseUrl,
          apiKey: this.apiKey || 'public',
          model: this._model,
          messages,
          options,
          additionalHeaders: headers,
        }),
      options?.signal
    );
  }

  async listModels(): Promise<Model[]> {
    return listOpenCodeModels(this.baseUrl, this.apiKey);
  }
}
