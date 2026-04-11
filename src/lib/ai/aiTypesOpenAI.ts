import type { OpenAIToolCall, OpenAIToolDefinition } from './aiTypesShared';

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
