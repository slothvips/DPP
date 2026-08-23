import { useCallback, useRef } from 'react';
import { hasAssistantOutput, runAgentTurn } from '@/lib/ai/agentRuntime';
import { formatPlanContext, getPlan } from '@/lib/ai/plan';
import { generateSystemPrompt } from '@/lib/ai/prompt';
import { toolRegistry } from '@/lib/ai/tools';
import { stopActiveBrowserTask } from '@/lib/ai/tools/browserTask';
import type { AIProviderType, ChatMessage as ProviderChatMessage } from '@/lib/ai/types';
import type { ChatMessage } from '../types';
import { useAIChatProvider } from './useAIChatProvider';
import {
  buildRuntimeRequestMessages,
  createAssistantRuntimeMessage,
  resolveRuntimeToolChoice,
} from './useAIChatRuntimeShared';

interface UseAIChatRuntimeOptions {
  sessionId: string | null;
  createAssistantPlaceholder: () => void;
  onStreamStart: () => void;
  onStreamChunk: (chunk: string) => void;
  onReasoningChunk: (chunk: string) => void;
  onPersistAssistantMessage: (message: ChatMessage) => Promise<void>;
  onAssistantMessage: (message: ChatMessage) => void;
}

interface UseAIChatRuntimeReturn {
  currentProvider: AIProviderType | null;
  runChatCompletion: (apiMessages: ProviderChatMessage[]) => Promise<ChatMessage>;
  generateSessionTitle: (userMessage: string) => Promise<string>;
  stopRuntime: (sessionId?: string | null, stopBrowserTask?: boolean) => void;
  resetRuntimeState: () => void;
  resetProvider: () => void;
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
  const { currentProvider, getProvider, resetProvider } = useAIChatProvider();
  const abortControllerRef = useRef<AbortController | null>(null);
  const accumulatedContentRef = useRef('');
  const accumulatedReasoningRef = useRef('');
  const hasStreamedChunkRef = useRef(false);

  const resetRuntimeState = useCallback(() => {
    accumulatedContentRef.current = '';
    accumulatedReasoningRef.current = '';
    hasStreamedChunkRef.current = false;
  }, []);

  const runChatCompletion = useCallback(
    async (apiMessages: ProviderChatMessage[]) => {
      const provider = await getProvider();
      const plan = sessionId ? await getPlan({ type: 'ai_session', id: sessionId }) : undefined;
      const systemPrompt = `${generateSystemPrompt()}\n\n${formatPlanContext(plan, 'ai_session')}`;
      const tools = toolRegistry.getOpenAITools();

      resetRuntimeState();
      createAssistantPlaceholder();
      abortControllerRef.current = new AbortController();
      const contextWindowPromise = provider.getContextWindow?.();

      const response = await runAgentTurn({
        provider,
        messages: buildRuntimeRequestMessages(systemPrompt, apiMessages),
        stream: true,
        signal: abortControllerRef.current.signal,
        tools,
        toolChoice: resolveRuntimeToolChoice(tools),
        onChunk: (chunk) => {
          if (!hasStreamedChunkRef.current) {
            hasStreamedChunkRef.current = true;
            onStreamStart();
          }
          accumulatedContentRef.current += chunk;
          onStreamChunk(chunk);
        },
        onReasoningChunk: (chunk) => {
          accumulatedReasoningRef.current += chunk;
          onReasoningChunk(chunk);
        },
      });

      const contextWindow = response.usage ? await contextWindowPromise : undefined;
      const usage = response.usage
        ? { ...response.usage, contextWindow: contextWindow ?? response.usage.contextWindow }
        : undefined;

      const providerMetadata = response.message.providerMetadata
        ? {
            ...response.message.providerMetadata,
            ...(accumulatedReasoningRef.current &&
            !response.message.providerMetadata.openAIReasoningContent
              ? { openAIReasoningContent: accumulatedReasoningRef.current }
              : {}),
          }
        : accumulatedReasoningRef.current
          ? { openAIReasoningContent: accumulatedReasoningRef.current }
          : undefined;
      const assistantMessage = createAssistantRuntimeMessage(
        response.message.content || accumulatedContentRef.current,
        response.message.toolCalls,
        providerMetadata,
        usage
      );

      onAssistantMessage(assistantMessage);
      if (hasAssistantOutput(assistantMessage)) {
        await onPersistAssistantMessage(assistantMessage);
      }
      return assistantMessage;
    },
    [
      createAssistantPlaceholder,
      getProvider,
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
    (targetSessionId = sessionId, stopBrowserTask = true) => {
      if (stopBrowserTask) {
        void stopActiveBrowserTask(targetSessionId || undefined, 'chat');
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      resetRuntimeState();
    },
    [resetRuntimeState, sessionId]
  );

  return {
    currentProvider,
    generateSessionTitle,
    runChatCompletion,
    stopRuntime,
    resetRuntimeState,
    resetProvider,
  };
}
