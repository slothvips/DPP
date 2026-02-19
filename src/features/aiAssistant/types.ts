// AI Assistant feature types
import type { AIProviderType } from '@/lib/ai/types';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  /** Tool name - used for tool result messages */
  name?: string;
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
