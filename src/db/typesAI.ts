import type { AIProviderType } from '@/lib/ai/providerIds';
import type { OpenAIToolCall, ProviderMessageMetadata, TokenUsage } from '@/lib/ai/types';

export interface AIProfile {
  id: string;
  name: string;
  provider: Exclude<AIProviderType, 'opencode'>;
  baseUrl: string;
  model: string;
  contextWindow?: number;
  visionEnabled?: boolean;
  apiKey: string | { ciphertext: string; iv: string };
  createdAt: number;
  updatedAt: number;
}

export interface AISession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface AIMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  name?: string;
  toolCallId?: string;
  toolCalls?: OpenAIToolCall[];
  providerMetadata?: ProviderMessageMetadata;
  usage?: TokenUsage;
  createdAt: number;
}
