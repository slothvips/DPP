// AI Model Provider types

export interface ModelProvider {
  name: string;
  baseUrl: string;
  model: string;
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse>;
  listModels(): Promise<Model[]>;
  getModelName(): string;
  setModel(model: string): void;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

export interface ChatOptions {
  tools?: AIToolDefinition[];
  temperature?: number;
  stream?: boolean;
  onChunk?: (chunk: string) => void;
}

export interface ChatResponse {
  message: {
    role: 'assistant';
    content: string;
    toolCalls?: ToolCall[];
  };
  done: boolean;
}

export interface Model {
  name: string;
  modified_at?: string;
  size?: number;
}

// Tool definitions
export interface AIToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: ToolParameter;
  };
}

export interface ToolParameter {
  type: 'object';
  properties: Record<string, ToolProperty>;
  required?: string[];
}

export interface ToolProperty {
  type: string;
  description: string;
  enum?: string[];
}

// Ollama API types
export interface OllamaChatRequest {
  model: string;
  messages: OllamaMessage[];
  stream?: boolean;
  tools?: OllamaTool[];
}

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: OllamaToolCall[];
}

export interface OllamaTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: ToolParameter;
  };
}

export interface OllamaToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

export interface OllamaChatResponse {
  message: {
    role: 'assistant';
    content: string;
    tool_calls?: OllamaToolCall[];
  };
  done: boolean;
}

export interface OllamaModelListResponse {
  models: Model[];
}
