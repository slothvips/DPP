import { createConfiguredProvider } from '@/lib/ai/config';
import type { ChatMessage, OpenAIChatRequest, ProviderRequestOptions } from '@/lib/ai/types';
import { HttpResponseError } from '@/lib/http';
import type {
  PageAgentLlmAbortMessage,
  PageAgentLlmRequestMessage,
} from '@/lib/pageAgent/multiPageTypes';
import { normalizeOpenCodePageAgentRequest } from '@/lib/pageAgent/openCodePageAgentProxy';
import { logger } from '@/utils/logger';

const activeRequests = new Map<string, AbortController>();

function parseRequest(body: string): OpenAIChatRequest {
  const parsed: unknown = JSON.parse(body);
  if (!parsed || typeof parsed !== 'object' || !('messages' in parsed)) {
    throw new Error('PageAgent LLM 请求格式无效');
  }
  const request = parsed as OpenAIChatRequest;
  if (!Array.isArray(request.messages)) throw new Error('PageAgent 请求缺少 messages');
  return request;
}

function providerOptions(request: OpenAIChatRequest): ProviderRequestOptions {
  return {
    enableThinking:
      typeof request.enable_thinking === 'boolean' ? request.enable_thinking : undefined,
    thinking: request.thinking?.type === 'disabled' ? { type: 'disabled' } : undefined,
    reasoningEffort: ['none', 'minimal', 'low', 'medium', 'high'].includes(
      request.reasoning_effort || ''
    )
      ? request.reasoning_effort
      : undefined,
    verbosity: ['low', 'medium', 'high'].includes(request.verbosity || '')
      ? request.verbosity
      : undefined,
  };
}

function normalizeToolChoice(value: unknown): OpenAIChatRequest['tool_choice'] | undefined {
  if (value === 'auto' || value === 'none' || value === 'required') return value;
  if (!value || typeof value !== 'object') return undefined;
  const choice = value as { type?: unknown; name?: unknown; function?: { name?: unknown } };
  if (choice.type === 'function' && typeof choice.function?.name === 'string') {
    return { type: 'function', function: { name: choice.function.name } };
  }
  if (choice.type === 'any') return 'required';
  if (choice.type === 'tool' && typeof choice.name === 'string') {
    return { type: 'function', function: { name: choice.name } };
  }
  return undefined;
}

export async function handlePageAgentLlmRequest(request: PageAgentLlmRequestMessage) {
  const controller = new AbortController();
  activeRequests.set(request.requestId, controller);
  try {
    const parsedRequest = parseRequest(request.body);
    const { provider, model } = await createConfiguredProvider({
      includeLegacyFallback: false,
      logPrefix: '[PageAgent LLM Bridge]',
    });
    const pageRequest =
      provider.name === 'opencode'
        ? normalizeOpenCodePageAgentRequest(parsedRequest)
        : parsedRequest;
    const messages: ChatMessage[] = pageRequest.messages.map((message) => ({
      role: message.role,
      content: message.content || '',
      name: message.name,
      toolCallId: message.tool_call_id,
      toolCalls: message.tool_calls,
      providerMetadata: message.reasoning_content
        ? { openAIReasoningContent: message.reasoning_content }
        : undefined,
    }));
    const chatOptions = {
      temperature: provider.name === 'opencode' ? undefined : pageRequest.temperature,
      includeStreamUsage: provider.name !== 'opencode',
      tools: pageRequest.tools,
      toolChoice: normalizeToolChoice(pageRequest.tool_choice),
      providerOptions: provider.name === 'opencode' ? undefined : providerOptions(pageRequest),
      signal: controller.signal,
      stream: true,
      onChunk: () => {},
    };
    let response;
    try {
      response = await provider.chat(messages, chatOptions);
    } catch (error) {
      if (
        provider.name !== 'opencode' ||
        !(error instanceof HttpResponseError) ||
        error.status !== 400 ||
        !chatOptions.tools?.length ||
        chatOptions.toolChoice === undefined
      ) {
        throw error;
      }

      logger.warn(
        '[PageAgent LLM Bridge] OpenCode rejected required tool choice; retrying with auto'
      );
      response = await provider.chat(messages, {
        ...chatOptions,
        toolChoice: undefined,
      });
    }
    return {
      success: true as const,
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      body: {
        id: `dpp-page-agent-${crypto.randomUUID()}`,
        model,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: response.message.content || null,
              tool_calls: response.message.toolCalls,
              reasoning_content: response.message.providerMetadata?.openAIReasoningContent,
            },
            finish_reason: response.message.toolCalls?.length ? 'tool_calls' : 'stop',
          },
        ],
      },
    };
  } catch (error) {
    logger.error('[PageAgent LLM Bridge] 请求失败:', error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : '模型请求失败',
      status: error instanceof HttpResponseError ? error.status : 502,
    };
  } finally {
    activeRequests.delete(request.requestId);
  }
}

export function handlePageAgentLlmAbort(request: PageAgentLlmAbortMessage): { success: boolean } {
  activeRequests.get(request.requestId)?.abort();
  return { success: true };
}
