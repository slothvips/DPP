import type { OpenAIToolCall } from '@/lib/ai/types';

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
  createdAt: number;
}
