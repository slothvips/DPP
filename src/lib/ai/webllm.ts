// WebLLM model provider implementation
/// <reference types="@webgpu/types" />
import { logger } from '@/utils/logger';
import * as webllm from '@mlc-ai/web-llm';
import type {
  ChatMessage,
  ChatOptions,
  ChatResponse,
  InitProgressCallback,
  Model,
  ModelProvider,
} from './types';

/**
 * Default WebLLM configuration
 */
export const DEFAULT_WEBLLM_MODEL = 'Qwen3-1.7B-q4f16_1-MLC';

/**
 * WebLLM model information with descriptions
 */
export interface WebLLMModelInfo {
  name: string;
  size: string;
  description: string;
  recommendedFor: string;
}

/**
 * Supported WebLLM models
 */
export const WEBLLM_MODELS: WebLLMModelInfo[] = [
  {
    name: 'Qwen3-1.7B-q4f16_1-MLC',
    size: '~1.2GB',
    description: '阿里千问 3 一点七参数版本，q4f16 量化 (推荐)',
    recommendedFor: '通用推荐，显存 2GB+',
  },
  {
    name: 'Qwen3-4B-q4f16_1-MLC',
    size: '~2.5GB',
    description: '阿里千问 3 四参数版本，q4f16 量化',
    recommendedFor: '中等配置，显存 4GB+',
  },
];

/**
 * WebLLM provider implementation
 * Uses WebGPU to run LLMs locally in the browser
 */
export class WebLLMProvider implements ModelProvider {
  name = 'webllm';
  baseUrl = ''; // No external URL needed for local execution
  private _model: string;
  private engine: webllm.MLCEngine | null = null;
  private initialized = false;
  private initProgressCallback?: InitProgressCallback;

  constructor(model: string = DEFAULT_WEBLLM_MODEL) {
    this._model = model;
  }

  getModelName(): string {
    return this._model;
  }

  setModel(model: string): void {
    this._model = model;
    // Reset engine if model changes
    this.engine = null;
    this.initialized = false;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Initialize the WebLLM engine
   */
  async initialize(onProgress?: InitProgressCallback): Promise<void> {
    if (this.initialized && this.engine) {
      logger.info('[WebLLM] Already initialized');
      return;
    }

    this.initProgressCallback = onProgress;

    try {
      logger.info(`[WebLLM] Initializing model: ${this._model}`);

      // Use the progress callback from webllm
      const progressCallback = (progress: webllm.InitProgressReport) => {
        const progressPercent = Math.round(progress.progress * 100);
        const text = `${progressPercent}% - ${progress.text}`;
        logger.debug(`[WebLLM] ${text}`);
        this.initProgressCallback?.(progressPercent, text);
        onProgress?.(progressPercent, text);
      };

      // Create the MLC Engine
      this.engine = await webllm.CreateMLCEngine(this._model, {
        initProgressCallback: progressCallback,
        // Use default log level
        logLevel: 'INFO',
      });

      this.initialized = true;
      logger.info('[WebLLM] Engine initialized successfully');
    } catch (error) {
      logger.error('[WebLLM] Failed to initialize engine:', error);
      throw new Error(
        `WebLLM initialization failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Convert internal ChatMessage to WebLLM format
   */
  private toWebLLMMessage(message: ChatMessage): webllm.ChatCompletionMessageParam {
    return {
      role: message.role,
      content: message.content,
    };
  }

  /**
   * Send a chat request to WebLLM
   */
  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    if (!this.initialized || !this.engine) {
      throw new Error('WebLLM engine not initialized. Call initialize() first.');
    }

    const webllmMessages: webllm.ChatCompletionMessageParam[] = messages.map((m) =>
      this.toWebLLMMessage(m)
    );

    logger.debug(`[WebLLM] Sending chat request with model: ${this._model}`);

    try {
      if (options?.stream && options.onChunk) {
        return this.handleStreamingChat(webllmMessages, options);
      }

      // Non-streaming request
      const chunks: string[] = [];
      const completion = await this.engine.chat.completions.create({
        messages: webllmMessages,
        temperature: options?.temperature,
        stream: false,
      });

      const content = completion.choices[0]?.message?.content || '';
      chunks.push(content);

      return {
        message: {
          role: 'assistant',
          content,
        },
        done: true,
      };
    } catch (error) {
      logger.error('[WebLLM] Chat request failed:', error);
      throw new Error(
        `WebLLM chat error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Handle streaming chat response
   */
  private async handleStreamingChat(
    messages: webllm.ChatCompletionMessageParam[],
    options: ChatOptions
  ): Promise<ChatResponse> {
    if (!this.engine) {
      throw new Error('WebLLM engine not initialized');
    }

    const onChunk = options.onChunk;
    if (!onChunk) {
      throw new Error('onChunk callback is required for streaming');
    }

    let fullContent = '';

    try {
      const stream = await this.engine.chat.completions.create({
        messages,
        temperature: options.temperature,
        stream: true,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (delta?.content) {
          fullContent += delta.content;
          onChunk(delta.content);
        }
      }

      return {
        message: {
          role: 'assistant',
          content: fullContent,
        },
        done: true,
      };
    } catch (error) {
      logger.error('[WebLLM] Streaming chat failed:', error);
      throw new Error(
        `WebLLM streaming error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * List available models (returns hardcoded list)
   */
  async listModels(): Promise<Model[]> {
    return WEBLLM_MODELS.map((m) => ({
      name: m.name,
      size: m.size ? parseSizeToBytes(m.size) : undefined,
    }));
  }

  /**
   * Check if WebLLM is supported in this environment
   */
  static async isSupported(): Promise<boolean> {
    try {
      // Check if WebGPU is available
      if (!navigator.gpu) {
        logger.warn('[WebLLM] WebGPU not available');
        return false;
      }

      const adapters = await navigator.gpu.requestAdapter();
      if (!adapters) {
        logger.warn('[WebLLM] No GPU adapter available');
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Parse size string (e.g., "~2GB") to bytes
 */
export function parseSizeToBytes(sizeStr: string): number {
  const match = sizeStr.match(/~?(\d+(?:\.\d+)?)\s*(GB|MB)/i);
  if (!match) return 0;

  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();

  return unit === 'GB' ? value * 1024 * 1024 * 1024 : value * 1024 * 1024;
}

/**
 * Create a new WebLLM provider instance
 */
export function createWebLLMProvider(model: string = DEFAULT_WEBLLM_MODEL): WebLLMProvider {
  return new WebLLMProvider(model);
}
