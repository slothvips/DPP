import type { Model, OpenAIToolCall, OpenAIToolDefinition } from './aiTypesShared';

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
