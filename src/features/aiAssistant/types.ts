// AI Assistant feature types
import type { AIToolDefinition } from '@/lib/ai/types';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  name?: string;
  createdAt: number;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatResponse {
  message: ChatMessage;
  toolCalls?: ToolCall[];
}

export interface AIConfig {
  provider: 'ollama';
  baseUrl: string;
  model: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  tools?: AIToolDefinition[];
  systemPrompt?: string;
}
