import type { ChatMessage, ChatResponse, ModelProvider, OpenAIToolDefinition } from './types';

export interface AgentTurnOptions {
  provider: ModelProvider;
  messages: ChatMessage[];
  tools?: OpenAIToolDefinition[];
  signal?: AbortSignal;
  stream?: boolean;
  toolChoice?: Parameters<ModelProvider['chat']>[1] extends infer Options
    ? Options extends { toolChoice?: infer Choice }
      ? Choice
      : never
    : never;
  onChunk?: (chunk: string) => void;
  onReasoningChunk?: (chunk: string) => void;
}

export async function runAgentTurn({
  provider,
  messages,
  tools,
  signal,
  stream = false,
  toolChoice,
  onChunk,
  onReasoningChunk,
}: AgentTurnOptions): Promise<ChatResponse> {
  return provider.chat(messages, {
    stream,
    signal,
    tools,
    toolChoice,
    onChunk,
    onReasoningChunk,
  });
}

export function hasAssistantOutput(
  message: Pick<ChatMessage, 'content' | 'toolCalls' | 'providerMetadata'>
): boolean {
  return Boolean(
    message.content.trim() ||
    message.toolCalls?.length ||
    message.providerMetadata?.openAIReasoningContent ||
    message.providerMetadata?.anthropicContentBlocks?.length ||
    message.providerMetadata?.aiSdkResponseMessages?.length
  );
}

export function trimAgentContext(messages: ChatMessage[], maxMessages = 5): void {
  if (messages.length <= maxMessages) return;
  const preserved = messages.slice(0, 2);
  const turns: ChatMessage[][] = [];
  for (const message of messages.slice(2)) {
    if (turns.length === 0 && message.role !== 'assistant') continue;
    if (message.role === 'assistant') {
      turns.push([message]);
    } else {
      turns[turns.length - 1].push(message);
    }
  }

  const recent: ChatMessage[] = [];
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index];
    if (recent.length > 0 && recent.length + turn.length > maxMessages - preserved.length) {
      break;
    }
    recent.unshift(...turn);
  }
  messages.splice(0, messages.length, ...preserved, ...recent);
}
