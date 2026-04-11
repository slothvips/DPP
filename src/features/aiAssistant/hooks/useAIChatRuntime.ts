import { useCallback, useRef } from 'react';
import { generateSystemPrompt } from '@/lib/ai/prompt';
import { toolRegistry } from '@/lib/ai/tools';
import type { AIProviderType, ChatMessage as ProviderChatMessage } from '@/lib/ai/types';
import type { ChatMessage } from '../types';
import { useAIChatProvider } from './useAIChatProvider';
import {
  buildRuntimeRequestMessages,
  createAssistantRuntimeMessage,
  resolveRuntimeToolChoice,
} from './useAIChatRuntimeShared';

interface UseAIChatRuntimeOptions {
  createAssistantPlaceholder: () => void;
  onStreamStart: () => void;
  onStreamChunk: (chunk: string) => void;
  onPersistAssistantMessage: (message: ChatMessage) => Promise<void>;
  onAssistantMessage: (message: ChatMessage) => void;
}

interface UseAIChatRuntimeReturn {
  currentProvider: AIProviderType | null;
  runChatCompletion: (apiMessages: ProviderChatMessage[]) => Promise<ChatMessage>;
  stopRuntime: () => void;
  resetRuntimeState: () => void;
  resetProvider: () => void;
}

export function useAIChatRuntime({
  createAssistantPlaceholder,
  onStreamStart,
  onStreamChunk,
  onPersistAssistantMessage,
  onAssistantMessage,
}: UseAIChatRuntimeOptions): UseAIChatRuntimeReturn {
  const { currentProvider, getProvider, resetProvider } = useAIChatProvider();
  const abortControllerRef = useRef<AbortController | null>(null);
  const accumulatedContentRef = useRef('');
  const hasStreamedChunkRef = useRef(false);

  const resetRuntimeState = useCallback(() => {
    accumulatedContentRef.current = '';
    hasStreamedChunkRef.current = false;
  }, []);

  const runChatCompletion = useCallback(
    async (apiMessages: ProviderChatMessage[]) => {
      const provider = await getProvider();
      const systemPrompt = generateSystemPrompt();
      const tools = toolRegistry.getOpenAITools();

      resetRuntimeState();
      createAssistantPlaceholder();
      abortControllerRef.current = new AbortController();

      const response = await provider.chat(buildRuntimeRequestMessages(systemPrompt, apiMessages), {
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
      });

      const assistantMessage = createAssistantRuntimeMessage(
        response.message.content || accumulatedContentRef.current,
        response.message.toolCalls
      );

      onAssistantMessage(assistantMessage);
      await onPersistAssistantMessage(assistantMessage);
      return assistantMessage;
    },
    [
      createAssistantPlaceholder,
      getProvider,
      onAssistantMessage,
      onPersistAssistantMessage,
      onStreamChunk,
      onStreamStart,
      resetRuntimeState,
    ]
  );

  const stopRuntime = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    resetRuntimeState();
  }, [resetRuntimeState]);

  return {
    currentProvider,
    runChatCompletion,
    stopRuntime,
    resetRuntimeState,
    resetProvider,
  };
}
