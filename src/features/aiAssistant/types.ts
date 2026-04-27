// AI Assistant feature types
import type { AIProviderType, OpenAIToolCall, ProviderMessageMetadata } from '@/lib/ai/types';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  /** Tool name - used for tool result messages */
  name?: string;
  toolCallId?: string;
  toolCalls?: OpenAIToolCall[];
  providerMetadata?: ProviderMessageMetadata;
  createdAt: number;
}

export interface AIConfig {
  provider: AIProviderType;
  baseUrl: string;
  model: string;
  apiKey?: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  systemPrompt?: string;
}

export interface AISession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}
