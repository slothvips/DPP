import type {
  ChatMessage,
  ChatOptions,
  ChatResponse,
  OllamaChatRequest,
  OllamaChatResponse,
  OllamaMessage,
} from './types';

export const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434';
export const DEFAULT_OLLAMA_MODEL = 'llama3.2';

export function stripThinkingContent(content: string): string {
  return content
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>[\s\S]*$/gi, '')
    .trim();
}

export function toOllamaMessage(message: ChatMessage): OllamaMessage {
  return {
    role: message.role,
    content: message.content,
    name: message.name,
    tool_call_id: message.toolCallId,
    tool_calls: message.toolCalls,
  };
}

export function buildOllamaChatRequest(
  model: string,
  messages: ChatMessage[],
  options?: ChatOptions
): OllamaChatRequest {
  const requestBody: OllamaChatRequest = {
    model,
    messages: messages.map(toOllamaMessage),
    stream: options?.stream ?? false,
  };

  if (options?.tools && options.tools.length > 0) {
    requestBody.tools = options.tools;
  }

  return requestBody;
}

export function mapOllamaResponse(response: OllamaChatResponse): ChatResponse {
  return {
    message: {
      role: response.message.role,
      content: stripThinkingContent(response.message.content),
      toolCalls: response.message.tool_calls,
    },
    done: response.done,
    finishReason: response.message.tool_calls?.length ? 'tool_calls' : 'stop',
  };
}
