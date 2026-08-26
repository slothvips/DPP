import { addMessage } from '@/lib/db/ai';
import { logger } from '@/utils/logger';
import { redactSensitiveJsonObject } from '@/utils/sensitive';
import type { ChatMessage } from '../types';

const TEST_RUN_MESSAGE_PLACEHOLDER = '[测试执行消息已脱敏]';

function sanitizeToolCalls(message: ChatMessage): ChatMessage['toolCalls'] {
  return message.toolCalls?.map((toolCall) => ({
    ...toolCall,
    function: {
      ...toolCall.function,
      arguments: sanitizeToolCallArguments(toolCall.function.name, toolCall.function.arguments),
    },
  }));
}

function sanitizeToolCallArguments(name: string, argumentsJson: string): string {
  if (name === 'test_run_update_step') {
    try {
      const parsed = JSON.parse(argumentsJson) as Record<string, unknown>;
      return JSON.stringify({
        run_id: parsed.run_id,
        current_step_id: parsed.current_step_id,
        step_id: parsed.step_id,
        order: parsed.order,
        status: parsed.status,
        result: '[redacted from chat history]',
      });
    } catch {
      return '{"result":"[redacted from chat history]"}';
    }
  }
  if (name === 'test_run_finish') {
    try {
      const parsed = JSON.parse(argumentsJson) as Record<string, unknown>;
      return JSON.stringify({
        run_id: parsed.run_id,
        status: parsed.status,
        report: '[redacted from chat history]',
      });
    } catch {
      return '{"report":"[redacted from chat history]"}';
    }
  }
  return redactSensitiveJsonObject(argumentsJson);
}

function sanitizeToolMessageContent(message: ChatMessage): string {
  if (message.name === 'test_run_update_step' || message.name === 'test_run_finish') {
    return TEST_RUN_MESSAGE_PLACEHOLDER;
  }
  return redactSensitiveJsonObject(message.content);
}

export async function saveUserMessage(sessionId: string | null, message: ChatMessage) {
  if (!sessionId) {
    return;
  }

  try {
    await addMessage({
      sessionId,
      id: message.id,
      role: 'user',
      content: message.content,
    });
  } catch (error) {
    logger.error('[AIChat] Failed to save user message:', error);
  }
}

export async function saveAssistantMessage(sessionId: string | null, message: ChatMessage) {
  if (!sessionId) {
    return;
  }

  try {
    await addMessage({
      sessionId,
      id: message.id,
      role: 'assistant',
      content: message.content,
      name: message.name,
      toolCalls: sanitizeToolCalls(message),
      providerMetadata: message.providerMetadata,
      usage: message.usage,
    });
  } catch (error) {
    logger.error('[AIChat] Failed to save assistant message:', error);
  }
}

export async function saveToolMessages(sessionId: string | null, toolMessages: ChatMessage[]) {
  if (!sessionId || toolMessages.length === 0) {
    return;
  }

  const batchCreatedAt = Date.now();
  for (const [index, message] of toolMessages.entries()) {
    try {
      await addMessage({
        sessionId,
        id: message.id,
        role: 'tool',
        content: sanitizeToolMessageContent(message),
        name: message.name,
        toolCallId: message.toolCallId,
        createdAt: batchCreatedAt + index,
      });
    } catch (error) {
      logger.error('[AIChat] Failed to save tool result:', error);
    }
  }
}
