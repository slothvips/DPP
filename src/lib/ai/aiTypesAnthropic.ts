import type { ToolParameter } from './aiTypesShared';

export interface AnthropicToolDefinition {
  name: string;
  description: string;
  input_schema: ToolParameter;
}

export interface AnthropicTextBlock {
  type: 'text';
  text: string;
}

export interface AnthropicImageBlock {
  type: 'image';
  source: {
    type: 'base64';
    media_type: 'image/jpeg' | 'image/png';
    data: string;
  };
}

export interface AnthropicThinkingBlock {
  type: 'thinking';
  thinking: string;
  signature?: string;
}

export interface AnthropicRedactedThinkingBlock {
  type: 'redacted_thinking';
  data: string;
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
  | AnthropicImageBlock
  | AnthropicThinkingBlock
  | AnthropicRedactedThinkingBlock
  | AnthropicToolUseBlock
  | AnthropicToolResultBlock;

export type AnthropicResponseContentBlock =
  | AnthropicTextBlock
  | AnthropicThinkingBlock
  | AnthropicRedactedThinkingBlock
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
  tool_choice?: { type: 'auto' | 'any' | 'none' } | { type: 'tool'; name: string };
  thinking?: { type: string };
  temperature?: number;
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
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
}
