export type { AIProviderType } from './providerIds';

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

export type OpenAIToolChoice =
  | 'auto'
  | 'none'
  | 'required'
  | { type: 'function'; function: { name: string } };

export interface ProviderRequestOptions {
  enableThinking?: boolean;
  thinking?: { type: string };
  reasoningEffort?: 'none' | 'minimal' | 'low' | 'medium' | 'high';
  verbosity?: 'low' | 'medium' | 'high';
}

export interface ProviderMessageMetadata {
  anthropicContentBlocks?: unknown[];
  aiSdkResponseMessages?: unknown[];
  openAIReasoningContent?: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedInputTokens?: number;
  cacheWriteInputTokens?: number;
  contextWindow?: number;
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
  usage?: TokenUsage;
}

export interface ChatOptions {
  temperature?: number;
  stream?: boolean;
  includeStreamUsage?: boolean;
  signal?: AbortSignal;
  onChunk?: (chunk: string) => void;
  onReasoningChunk?: (chunk: string) => void;
  tools?: OpenAIToolDefinition[];
  toolChoice?: OpenAIToolChoice | null;
  providerOptions?: ProviderRequestOptions;
}

export interface InitProgressCallback {
  (progress: number, text: string): void;
}

export interface Model {
  name: string;
  modified_at?: string;
  size?: number;
  contextWindow?: number;
  availability?: 'checking' | 'available' | 'unavailable';
  availabilityError?: string;
}

export interface ModelProvider {
  name: string;
  baseUrl: string;
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse>;
  listModels(): Promise<Model[]>;
  getModelName(): string;
  getContextWindow?(): Promise<number | undefined>;
  setModel(model: string): void;
  initialize?(onProgress?: InitProgressCallback): Promise<void>;
  isInitialized?(): boolean;
}
