import type { PendingBuild, PreparedToolCall } from '@/features/aiAssistant/hooks/useAIChat.types';
import { ensureAIToolsRegistered } from '@/lib/ai';
import { getPlan } from '@/lib/ai/plan';
import { toolRegistry } from '@/lib/ai/tools';
import { stopActiveBrowserTask } from '@/lib/ai/tools/browserTask';
import { hasActiveTestRunForSession, stopTestRunForSession } from '@/lib/ai/tools/testRuns';
import { logger } from '@/utils/logger';
import { redactSensitiveFields } from '@/utils/sensitive';
import type { ChatMessage } from '../types';

const AI_CONFIG_SETTING_PATTERN = /^ai_/;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function shouldResetAIConfig(resultObj: { action?: string; updatedKeys?: unknown }): boolean {
  if (resultObj.action === 'ai_config_updated') {
    return true;
  }

  if (resultObj.action !== 'dpp_config_updated' || !Array.isArray(resultObj.updatedKeys)) {
    return false;
  }

  return resultObj.updatedKeys.some(
    (key) => typeof key === 'string' && AI_CONFIG_SETTING_PATTERN.test(key)
  );
}

export async function executePreparedToolCalls(preparedToolCalls: PreparedToolCall[]): Promise<{
  toolMessages: ChatMessage[];
  pendingBuild: PendingBuild | null;
}>;
export async function executePreparedToolCalls(
  preparedToolCalls: PreparedToolCall[],
  options: {
    onAIConfigChanged?: () => void;
    browserTaskSessionId?: string;
    sessionId?: string;
    requiresActivePlan?: boolean;
  }
): Promise<{
  toolMessages: ChatMessage[];
  pendingBuild: PendingBuild | null;
}>;
export async function executePreparedToolCalls(
  preparedToolCalls: PreparedToolCall[],
  options?: {
    onAIConfigChanged?: () => void;
    browserTaskSessionId?: string;
    sessionId?: string;
    requiresActivePlan?: boolean;
  }
): Promise<{
  toolMessages: ChatMessage[];
  pendingBuild: PendingBuild | null;
}> {
  ensureAIToolsRegistered();

  const availableToolNames = toolRegistry.getAll().map((tool) => tool.name);
  const toolMessages: ChatMessage[] = [];

  const requiresActivePlan = Boolean(
    options?.sessionId && (options.requiresActivePlan ?? preparedToolCalls.length > 1)
  );

  for (const [index, preparedToolCall] of preparedToolCalls.entries()) {
    try {
      if (
        requiresActivePlan &&
        preparedToolCall.toolCall.function.name !== 'manage_plan' &&
        options?.sessionId
      ) {
        await enforceActivePlan(options.sessionId);
      }
      const { toolMessage, pendingBuild } = await executePreparedToolCall(
        preparedToolCall,
        options,
        availableToolNames
      );
      if (pendingBuild) {
        return {
          toolMessages,
          pendingBuild: {
            ...pendingBuild,
            remainingToolCalls: preparedToolCalls.slice(index + 1).map((call) => call.toolCall),
          },
        };
      }
      toolMessages.push(toolMessage);
    } catch (error) {
      if (
        isTestRunMutation(preparedToolCall.toolCall.function.name) &&
        options?.browserTaskSessionId
      ) {
        await stopActiveBrowserTask(options.browserTaskSessionId, 'chat').catch((stopError) => {
          logger.error('[AIChat] Failed to stop browser tasks after test run error:', stopError);
        });
        await stopTestRunForSession(
          options.browserTaskSessionId,
          '测试执行工具保存失败，已停止后续网页操作'
        );
      }
      toolMessages.push(createToolErrorMessage(preparedToolCall, error));
      return { toolMessages, pendingBuild: null };
    }
  }

  return { toolMessages, pendingBuild: null };
}

async function enforceActivePlan(sessionId: string): Promise<void> {
  const plan = await getPlan({ type: 'ai_session', id: sessionId });
  if (!plan || plan.status !== 'active') {
    throw new Error('多步骤工具调用需要先创建并激活当前会话计划');
  }
}

async function executePreparedToolCall(
  preparedToolCall: PreparedToolCall,
  options:
    | {
        onAIConfigChanged?: () => void;
        browserTaskSessionId?: string;
        sessionId?: string;
        requiresActivePlan?: boolean;
      }
    | undefined,
  availableToolNames: string[]
): Promise<{ toolMessage: ChatMessage; pendingBuild: PendingBuild | null }> {
  const { toolCall, arguments: args } = preparedToolCall;
  logger.info(`[AIChat] Executing tool: ${toolCall.function.name}`, {
    args: redactSensitiveFields(args),
    availableTools: availableToolNames,
  });
  const toolArgs =
    toolCall.function.name === 'delegate_browser_agent' && options?.browserTaskSessionId
      ? {
          ...args,
          session_id: options.browserTaskSessionId,
          tool_call_id: toolCall.id,
          ...(hasActiveTestRunForSession(options.browserTaskSessionId) &&
          typeof args.test_target_id !== 'string'
            ? {
                resource_keys: [
                  ...(Array.isArray(args.resource_keys)
                    ? args.resource_keys.filter((key): key is string => typeof key === 'string')
                    : []),
                  'test-target:unknown',
                ],
              }
            : {}),
        }
      : toolCall.function.name === 'manage_plan' && options?.sessionId
        ? { ...args, __ownerType: 'ai_session', __ownerId: options.sessionId }
        : isTestRunTool(toolCall.function.name) && options?.sessionId
          ? {
              ...args,
              session_id: options.sessionId,
              ...(toolCall.function.name === 'test_run_execute'
                ? { tool_call_id: toolCall.id }
                : {}),
            }
          : args;
  const result = await toolRegistry.execute(toolCall.function.name, toolArgs);
  const resultObj = result as {
    action?: string;
    jobUrl?: string;
    jobName?: string;
    updatedKeys?: unknown;
  };

  if (shouldResetAIConfig(resultObj)) options?.onAIConfigChanged?.();
  if (resultObj.action === 'open_build_dialog' && resultObj.jobUrl && resultObj.jobName) {
    return {
      toolMessage: createToolMessage(toolCall, result),
      pendingBuild: {
        jobUrl: resultObj.jobUrl,
        jobName: resultObj.jobName,
        toolCallId: toolCall.id,
        toolName: toolCall.function.name,
        remainingToolCalls: [],
      },
    };
  }
  return { toolMessage: createToolMessage(toolCall, result), pendingBuild: null };
}

function isTestRunTool(name: string): boolean {
  return (
    name === 'test_run_execute' ||
    name === 'test_run_start' ||
    name === 'test_run_update_step' ||
    name === 'test_run_finish'
  );
}

function isTestRunMutation(name: string): boolean {
  return (
    name === 'test_run_execute' || name === 'test_run_update_step' || name === 'test_run_finish'
  );
}

function createToolMessage(toolCall: PreparedToolCall['toolCall'], result: unknown): ChatMessage {
  return {
    id: generateId(),
    role: 'tool',
    name: toolCall.function.name,
    toolCallId: toolCall.id,
    content: JSON.stringify(result, null, 2),
    createdAt: Date.now(),
  };
}

function createToolErrorMessage(toolCall: PreparedToolCall, error: unknown): ChatMessage {
  logger.error('[AIChat] Tool execution error:', error);
  return {
    id: generateId(),
    role: 'tool',
    name: toolCall.toolCall.function.name,
    toolCallId: toolCall.toolCall.id,
    content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    createdAt: Date.now(),
  };
}
