// AI Model Provider types

/**
 * Supported AI provider types
 */
export type AIProviderType = 'ollama' | 'anthropic' | 'custom';

// Tool parameter schema (used by tool registry)
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
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  toolCallId?: string;
  toolCalls?: OpenAIToolCall[];
}

export interface ChatOptions {
  temperature?: number;
  stream?: boolean;
  signal?: AbortSignal;
  onChunk?: (chunk: string) => void;
  tools?: OpenAIToolDefinition[];
  toolChoice?: 'auto' | 'none';
}

// WebLLM loading progress callback
export interface InitProgressCallback {
  (progress: number, text: string): void;
}

export interface ChatResponse {
  message: {
    role: 'assistant';
    content: string;
    toolCalls?: OpenAIToolCall[];
  };
  done: boolean;
  finishReason?: string | null;
}

export interface Model {
  name: string;
  modified_at?: string;
  size?: number;
}

// Ollama API types
export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: OpenAIToolCall[];
}

export interface OllamaChatRequest {
  model: string;
  messages: OllamaMessage[];
  tools?: OpenAIToolDefinition[];
  stream?: boolean;
}

export interface OllamaChatResponse {
  message: {
    role: 'assistant';
    content: string;
    tool_calls?: OpenAIToolCall[];
  };
  done: boolean;
}

export interface OllamaModelListResponse {
  models: Model[];
}

// OpenAI-compatible API types
export interface OpenAIChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: OpenAIToolCall[];
}

export interface OpenAIChatRequest {
  model: string;
  messages: OpenAIChatMessage[];
  tools?: OpenAIToolDefinition[];
  tool_choice?: 'auto' | 'none';
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
      content: string | null;
      tool_calls?: OpenAIToolCall[];
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
export interface AnthropicToolDefinition {
  name: string;
  description: string;
  input_schema: ToolParameter;
}

export interface AnthropicTextBlock {
  type: 'text';
  text: string;
}

export interface AnthropicThinkingBlock {
  type: 'thinking';
  thinking: string;
}

export interface AnthropicToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface AnthropicToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
}

export type AnthropicMessageContentBlock =
  | AnthropicTextBlock
  | AnthropicToolUseBlock
  | AnthropicToolResultBlock;

export type AnthropicResponseContentBlock =
  | AnthropicTextBlock
  | AnthropicThinkingBlock
  | AnthropicToolUseBlock;

export interface AnthropicChatMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicMessageContentBlock[];
}

export interface AnthropicChatRequest {
  model: string;
  messages: AnthropicChatMessage[];
  max_tokens: number;
  stream?: boolean;
  system?: string;
  tools?: AnthropicToolDefinition[];
}

export interface AnthropicChatResponse {
  id: string;
  type: string;
  role: 'assistant';
  content: AnthropicResponseContentBlock[];
  model: string;
  stop_reason: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}
