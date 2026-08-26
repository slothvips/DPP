import { createConfiguredProvider } from '@/lib/ai/config';
import type {
  ChatMessage,
  OpenAIToolCall,
  OpenAIToolChoice,
  OpenAIToolDefinition,
} from '@/lib/ai/types';
import type {
  PageAgentLlmAbortMessage,
  PageAgentLlmRequestMessage,
} from '@/lib/pageAgent/multiPageTypes';
import { logger } from '@/utils/logger';

const requests = new Map<string, { taskId: string; controller: AbortController }>();
const MAX_REQUEST_BODY_LENGTH = 2_000_000;

export async function handlePageAgentLlmRequest(message: PageAgentLlmRequestMessage) {
  if (!message.requestId || !message.taskId || message.body.length > MAX_REQUEST_BODY_LENGTH) {
    return { success: false as const, error: 'PageAgent 请求无效', status: 400 };
  }
  const controller = new AbortController();
  requests.set(message.requestId, { taskId: message.taskId, controller });
  try {
    const parsed: unknown = JSON.parse(message.body);
    if (!isRecord(parsed)) throw new Error('PageAgent 请求格式无效');
    const body = parsed as {
      messages?: Array<{
        role: ChatMessage['role'];
        content?: string | null;
        name?: string;
        tool_call_id?: string;
        tool_calls?: OpenAIToolCall[];
      }>;
      tools?: OpenAIToolDefinition[];
      tool_choice?: OpenAIToolChoice;
    };
    if (!Array.isArray(body.messages)) throw new Error('PageAgent 请求缺少 messages');
    if (body.messages.length > 200) throw new Error('PageAgent 请求消息过多');
    for (const item of body.messages) {
      if (
        !isRecord(item) ||
        !isChatRole(item.role) ||
        (item.content !== undefined && item.content !== null && typeof item.content !== 'string')
      ) {
        throw new Error('PageAgent 请求包含无效消息');
      }
    }
    const { provider, model } = await createConfiguredProvider({
      includeLegacyFallback: false,
      logPrefix: '[PageAgent]',
    });
    const messages: ChatMessage[] = body.messages.map((message) => ({
      role: message.role,
      content: message.content || '',
      name: message.name,
      toolCallId: message.tool_call_id,
      toolCalls: message.tool_calls,
    }));
    const response = await provider.chat(messages, {
      signal: controller.signal,
      stream: false,
      tools: body.tools,
      toolChoice: body.tool_choice,
    });
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
            },
            finish_reason: response.message.toolCalls?.length ? 'tool_calls' : 'stop',
          },
        ],
      },
    };
  } catch (error) {
    logger.error('[PageAgent] LLM 请求失败:', error);
    return {
      success: false as const,
      error: error instanceof Error ? error.message : String(error),
      status: 502,
    };
  } finally {
    requests.delete(message.requestId);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function handlePageAgentLlmAbort(message: PageAgentLlmAbortMessage) {
  const request = requests.get(message.requestId);
  if (request?.taskId === message.taskId) request.controller.abort();
  return { success: true };
}

function isChatRole(value: unknown): value is ChatMessage['role'] {
  return value === 'system' || value === 'user' || value === 'assistant' || value === 'tool';
}
