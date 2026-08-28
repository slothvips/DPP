import { useCallback, useEffect, useRef } from 'react';
import { hasAssistantOutput, runAgentTurn } from '@/lib/ai/agentRuntime';
import { formatPlanContext, getPlan } from '@/lib/ai/plan';
import { generateSystemPrompt } from '@/lib/ai/prompt';
import { ensureAIToolsRegistered } from '@/lib/ai';
import { toolRegistry } from '@/lib/ai/tools';
import { stopActiveBrowserTask } from '@/lib/ai/tools/browserTask';
import { stopTestRunForSession } from '@/lib/ai/tools/testRuns';
import type {
  AIProviderType,
  ChatMessage as ProviderChatMessage,
  ModelProvider,
} from '@/lib/ai/types';
import type { ChatMessage } from '../types';
import { useAIChatProvider } from './useAIChatProvider';
import {
  buildRuntimeRequestMessages,
  createAssistantRuntimeMessage,
  resolveRuntimeToolChoice,
} from './useAIChatRuntimeShared';

interface SessionRuntime {
  runId: string | null;
  abortController: AbortController | null;
  accumulatedContent: string;
  accumulatedReasoning: string;
  hasStreamedChunk: boolean;
}

interface UseAIChatRuntimeOptions {
  sessionId: string | null;
  createAssistantPlaceholder: (sessionId: string | null) => string | undefined;
  onStreamStart: (sessionId: string) => void;
  onStreamChunk: (sessionId: string, assistantMessageId: string, chunk: string) => void;
  onReasoningChunk: (sessionId: string, assistantMessageId: string, chunk: string) => void;
  onPersistAssistantMessage: (message: ChatMessage) => Promise<void>;
  onAssistantMessage: (sessionId: string, assistantMessageId: string, message: ChatMessage) => void;
}

interface UseAIChatRuntimeReturn {
  currentProvider: AIProviderType | null;
  currentProviderName: string | null;
  currentModel: string | null;
  runChatCompletion: (apiMessages: ProviderChatMessage[]) => Promise<ChatMessage | null>;
  generateSessionTitle: (userMessage: string) => Promise<string>;
  stopRuntime: (sessionId?: string | null, stopBrowserTask?: boolean) => Promise<void>;
  resetRuntimeState: (sessionId?: string | null) => void;
  getProvider: () => Promise<ModelProvider>;
  resetProvider: () => void;
}

function createRunId(): string {
  return crypto.randomUUID();
}

export function useAIChatRuntime({
  sessionId,
  createAssistantPlaceholder,
  onStreamStart,
  onStreamChunk,
  onReasoningChunk,
  onPersistAssistantMessage,
  onAssistantMessage,
}: UseAIChatRuntimeOptions): UseAIChatRuntimeReturn {
  const { currentProvider, currentProviderName, currentModel, getProvider, resetProvider } =
    useAIChatProvider();
  const runtimesRef = useRef(new Map<string, SessionRuntime>());

  const getRuntime = useCallback((id: string): SessionRuntime => {
    const existing = runtimesRef.current.get(id);
    if (existing) return existing;
    const runtime: SessionRuntime = {
      runId: null,
      abortController: null,
      accumulatedContent: '',
      accumulatedReasoning: '',
      hasStreamedChunk: false,
    };
    runtimesRef.current.set(id, runtime);
    return runtime;
  }, []);

  const resetRuntimeState = useCallback(
    (targetSessionId = sessionId) => {
      if (!targetSessionId) return;
      const runtime = getRuntime(targetSessionId);
      runtime.accumulatedContent = '';
      runtime.accumulatedReasoning = '';
      runtime.hasStreamedChunk = false;
    },
    [getRuntime, sessionId]
  );

  useEffect(() => {
    const runtimes = runtimesRef.current;
    return () => {
      for (const runtime of runtimes.values()) runtime.abortController?.abort();
    };
  }, []);

  const runChatCompletion = useCallback(
    async (apiMessages: ProviderChatMessage[]) => {
      if (!sessionId) throw new Error('缺少 AI 会话 ID');
      const targetSessionId = sessionId;
      const runtime = getRuntime(targetSessionId);
      const runId = createRunId();
      runtime.runId = runId;
      runtime.abortController = new AbortController();
      resetRuntimeState(targetSessionId);

      try {
        const provider = await getProvider();
        const plan = await getPlan({ type: 'ai_session', id: targetSessionId });
        const systemPrompt = `${generateSystemPrompt()}

${formatPlanContext(plan, 'ai_session')}`;
        ensureAIToolsRegistered();
        const tools = toolRegistry.getOpenAITools();
        const assistantMessageId = createAssistantPlaceholder(targetSessionId);
        if (!assistantMessageId) throw new Error('无法创建 assistant 消息');
        const contextWindowPromise = provider.getContextWindow?.();

        const response = await runAgentTurn({
          provider,
          messages: buildRuntimeRequestMessages(systemPrompt, apiMessages),
          stream: true,
          signal: runtime.abortController.signal,
          tools,
          toolChoice: resolveRuntimeToolChoice(tools),
          onChunk: (chunk) => {
            if (runtime.runId !== runId) return;
            if (!runtime.hasStreamedChunk) {
              runtime.hasStreamedChunk = true;
              onStreamStart(targetSessionId);
            }
            runtime.accumulatedContent += chunk;
            onStreamChunk(targetSessionId, assistantMessageId, chunk);
          },
          onReasoningChunk: (chunk) => {
            if (runtime.runId !== runId) return;
            runtime.accumulatedReasoning += chunk;
            onReasoningChunk(targetSessionId, assistantMessageId, chunk);
          },
        });

        const contextWindow = response.usage ? await contextWindowPromise : undefined;
        const usage = response.usage
          ? { ...response.usage, contextWindow: contextWindow ?? response.usage.contextWindow }
          : undefined;
        const providerMetadata = response.message.providerMetadata
          ? {
              ...response.message.providerMetadata,
              ...(runtime.accumulatedReasoning &&
              !response.message.providerMetadata.openAIReasoningContent
                ? { openAIReasoningContent: runtime.accumulatedReasoning }
                : {}),
            }
          : runtime.accumulatedReasoning
            ? { openAIReasoningContent: runtime.accumulatedReasoning }
            : undefined;
        const assistantMessage = createAssistantRuntimeMessage(
          response.message.content || runtime.accumulatedContent,
          response.message.toolCalls,
          providerMetadata,
          usage
        );

        if (runtime.runId !== runId) return null;
        onAssistantMessage(targetSessionId, assistantMessageId, assistantMessage);
        if (hasAssistantOutput(assistantMessage)) await onPersistAssistantMessage(assistantMessage);
        return assistantMessage;
      } finally {
        if (runtime.runId === runId) {
          runtime.runId = null;
          runtime.abortController = null;
        }
      }
    },
    [
      createAssistantPlaceholder,
      getProvider,
      getRuntime,
      onAssistantMessage,
      onPersistAssistantMessage,
      onReasoningChunk,
      onStreamChunk,
      onStreamStart,
      resetRuntimeState,
      sessionId,
    ]
  );

  const generateSessionTitle = useCallback(
    async (userMessage: string): Promise<string> => {
      const provider = await getProvider();
      const response = await provider.chat(
        [
          {
            role: 'system',
            content:
              '请为用户请求生成一个简短的会话标题。只输出标题本身，不要引号、Markdown 或解释，中文不超过 20 个字，其他语言不超过 8 个词。',
          },
          { role: 'user', content: `<user_request>\n${userMessage}\n</user_request>` },
        ],
        { stream: false, temperature: 0.2 }
      );
      return response.message.content.replace(/[\r\n]+/g, ' ').trim();
    },
    [getProvider]
  );

  const stopRuntime = useCallback(
    async (targetSessionId = sessionId, stopBrowserTask = true) => {
      if (!targetSessionId) return;
      const runtime = runtimesRef.current.get(targetSessionId);
      if (runtime) runtime.runId = null;
      runtime?.abortController?.abort();
      resetRuntimeState(targetSessionId);
      await Promise.all([
        stopBrowserTask ? stopActiveBrowserTask(targetSessionId, 'chat') : Promise.resolve(),
        stopTestRunForSession(targetSessionId, 'AI 会话已停止，测试执行已中止'),
      ]);
    },
    [resetRuntimeState, sessionId]
  );

  return {
    currentProvider,
    currentProviderName,
    currentModel,
    generateSessionTitle,
    runChatCompletion,
    stopRuntime,
    resetRuntimeState,
    getProvider,
    resetProvider,
  };
}
