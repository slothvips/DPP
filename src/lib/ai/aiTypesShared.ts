export type AIProviderType = 'ollama' | 'anthropic' | 'custom';

export interface ToolParameter {
  type: 'object';
  properties: Record<string, { type: string; description: string; enum?: string[] }>;
  required?: string[];
}

export interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface OpenAIToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: ToolParameter;
  };
}

export interface ProviderMessageMetadata {
  anthropicContentBlocks?: unknown[];
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  toolCallId?: string;
  toolCalls?: OpenAIToolCall[];
  providerMetadata?: ProviderMessageMetadata;
}

export interface ChatResponse {
  message: {
    role: 'assistant';
    content: string;
    toolCalls?: OpenAIToolCall[];
    providerMetadata?: ProviderMessageMetadata;
  };
  done: boolean;
  finishReason?: string | null;
}

export interface ChatOptions {
  temperature?: number;
  stream?: boolean;
  signal?: AbortSignal;
  onChunk?: (chunk: string) => void;
  tools?: OpenAIToolDefinition[];
  toolChoice?: 'auto' | 'none';
}

export interface InitProgressCallback {
  (progress: number, text: string): void;
}

export interface Model {
  name: string;
  modified_at?: string;
  size?: number;
}

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
