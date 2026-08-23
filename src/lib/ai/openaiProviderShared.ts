import { describeOpenAIResponseBody } from './openAIResponseGuards';
import { mapOpenAIToolCalls, openAIToolChoice } from './providerShared';
import { stripThinkingContent } from './stripThinking';
import { createTokenUsage } from './tokenUsage';
import type {
  ChatMessage,
  ChatOptions,
  ChatResponse,
  OpenAIChatMessage,
  OpenAIChatRequest,
  OpenAIChatResponse,
} from './types';

export function getOpenAIHeaders(apiKey: string, additionalHeaders?: HeadersInit): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    ...additionalHeaders,
  };
}

export function buildOpenAIApiUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '').replace(/\/chat\/completions$/i, '')}/${path}`;
}

export function toOpenAIMessage(message: ChatMessage): OpenAIChatMessage {
  return {
    role: message.role,
    content:
      message.role === 'user' && message.images?.length
        ? [
            { type: 'text', text: message.content },
            ...message.images.map((image) => ({
              type: 'image_url' as const,
              image_url: { url: `data:${image.mediaType};base64,${image.data}` },
            })),
          ]
        : message.content,
    name: message.name,
    reasoning_content:
      message.role === 'assistant' ? message.providerMetadata?.openAIReasoningContent : undefined,
    tool_call_id: message.toolCallId,
    tool_calls: mapOpenAIToolCalls(message.toolCalls),
  };
}

export function buildOpenAIChatRequest(
  model: string,
  messages: ChatMessage[],
  options?: ChatOptions
): OpenAIChatRequest {
  const requestBody: OpenAIChatRequest = {
    model,
    messages: messages.map(toOpenAIMessage),
    stream: options?.stream ?? false,
  };

  if (requestBody.stream && options?.includeStreamUsage !== false) {
    requestBody.stream_options = { include_usage: true };
  }

  if (options?.temperature !== undefined) {
    requestBody.temperature = options.temperature;
  }

  if (options?.tools?.length) {
    requestBody.tools = options.tools;
    if (options.toolChoice !== null) {
      requestBody.tool_choice = openAIToolChoice(options.toolChoice) || 'auto';
    }
  }

  const providerOptions = options?.providerOptions;
  requestBody.enable_thinking = providerOptions?.enableThinking;
  requestBody.thinking = providerOptions?.thinking;
  requestBody.reasoning_effort = providerOptions?.reasoningEffort;
  requestBody.verbosity = providerOptions?.verbosity;

  return requestBody;
}

export function mapOpenAIResponse(response: OpenAIChatResponse): ChatResponse {
  const choice = response.choices?.[0];
  if (!choice?.message) {
    // 部分 OpenAI 兼容服务在配额、限流或参数问题时仍返回 HTTP 200，
    // 响应体不含 choices（如 {"error":{...}}），必须把真实原因抛给上层
    throw new Error(`OpenAI 响应缺少 choices：${describeOpenAIResponseBody(response)}`);
  }
  return {
    message: {
      role: choice.message.role,
      content: stripThinkingContent(choice.message.content || ''),
      toolCalls: mapOpenAIToolCalls(choice.message.tool_calls),
      providerMetadata: choice.message.reasoning_content
        ? { openAIReasoningContent: choice.message.reasoning_content }
        : undefined,
    },
    done: choice.finish_reason === 'stop' || choice.finish_reason === 'tool_calls',
    finishReason: choice.finish_reason,
    usage: createTokenUsage({
      inputTokens: response.usage?.prompt_tokens,
      outputTokens: response.usage?.completion_tokens,
      totalTokens: response.usage?.total_tokens,
      cachedInputTokens: response.usage?.prompt_tokens_details?.cached_tokens,
    }),
  };
}
