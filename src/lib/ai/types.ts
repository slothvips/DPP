// AI Model Provider types

/**
 * Supported AI provider types
 */
export type AIProviderType = 'ollama' | 'openai' | 'anthropic' | 'custom' | 'webllm';

export interface ModelProvider {
  name: string;
  baseUrl: string;
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse>;
  listModels(): Promise<Model[]>;
  getModelName(): string;
  setModel(model: string): void;
  initialize?(onProgress?: InitProgressCallback): Promise<void>;
  isInitialized?(): boolean;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  stream?: boolean;
  onChunk?: (chunk: string) => void;
}

// WebLLM loading progress callback
export interface InitProgressCallback {
  (progress: number, text: string): void;
}

export interface ChatResponse {
  message: {
    role: 'assistant';
    content: string;
  };
  done: boolean;
}

export interface Model {
  name: string;
  modified_at?: string;
  size?: number;
}

// Tool parameter schema (used by tool registry)
export interface ToolParameter {
  type: 'object';
  properties: Record<string, { type: string; description: string; enum?: string[] }>;
  required?: string[];
}

// Ollama API types
export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OllamaChatRequest {
  model: string;
  messages: OllamaMessage[];
  stream?: boolean;
}

export interface OllamaChatResponse {
  message: {
    role: 'assistant';
    content: string;
  };
  done: boolean;
}

export interface OllamaModelListResponse {
  models: Model[];
}

// OpenAI-compatible API types
export interface OpenAIChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAIChatRequest {
  model: string;
  messages: OpenAIChatMessage[];
  stream?: boolean;
  temperature?: number;
}

export interface OpenAIChatResponse {
  id: string;
  model: string;
  choices: {
    index: number;
    message: {
      role: 'assistant';
      content: string;
    };
    finish_reason: string | null;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface OpenAIModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

export interface OpenAIModelsResponse {
  object: string;
  data: OpenAIModel[];
}

// Anthropic API types
export interface AnthropicChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AnthropicChatRequest {
  model: string;
  messages: AnthropicChatMessage[];
  max_tokens: number;
  stream?: boolean;
  system?: string;
}

export interface AnthropicChatResponse {
  id: string;
  type: string;
  role: 'assistant';
  content: string;
  model: string;
  stop_reason: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}
