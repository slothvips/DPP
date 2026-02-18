// AI Chat hook - Core conversation logic
import { useCallback, useEffect, useRef, useState } from 'react';
import { db } from '@/db';
import { DEFAULT_OLLAMA_BASE_URL, DEFAULT_OLLAMA_MODEL, OllamaProvider } from '@/lib/ai/ollama';
import { generateSystemPrompt } from '@/lib/ai/prompt';
import { toolRegistry } from '@/lib/ai/tools';
import type { AIToolDefinition } from '@/lib/ai/types';
import { logger } from '@/utils/logger';
import type { ChatMessage, ToolCall } from '../types';

/**
 * AI Chat state
 */
export type AIChatStatus = 'idle' | 'loading' | 'streaming' | 'error' | 'confirming';

/**
 * Pending tool call that requires confirmation
 */
export interface PendingToolCall {
  toolCall: ToolCall;
  arguments: Record<string, unknown>;
}

/**
 * useAIChat hook return type
 */
export interface UseAIChatReturn {
  // State
  messages: ChatMessage[];
  status: AIChatStatus;
  error: string | null;
  isConnected: boolean;
  pendingToolCall: PendingToolCall | null;

  // Actions
  sendMessage: (content: string) => Promise<void>;
  confirmToolCall: () => Promise<void>;
  cancelToolCall: () => void;
  clearMessages: () => void;
  checkConnection: () => Promise<boolean>;
}

/**
 * Generate a unique message ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * AI Chat hook - handles conversation, tool calls, and confirmation flow
 */
export function useAIChat(): UseAIChatReturn {
  // State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<AIChatStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [pendingToolCall, setPendingToolCall] = useState<PendingToolCall | null>(null);

  // Refs
  const providerRef = useRef<OllamaProvider | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Store callbacks in refs to avoid circular dependency warnings
  const executeToolCallRef = useRef<
    ((toolCall: ToolCall, userMessageId: string) => Promise<void>) | null
  >(null);
  const continueConversationRef = useRef<((allMessages: ChatMessage[]) => Promise<void>) | null>(
    null
  );

  /**
   * Initialize or get the AI provider
   */
  const getProvider = useCallback(async (): Promise<OllamaProvider> => {
    if (providerRef.current) {
      return providerRef.current;
    }

    // Get config from settings
    const baseUrlSetting = await db.settings.where('key').equals('ai_ollama_base_url').first();
    const modelSetting = await db.settings.where('key').equals('ai_ollama_model').first();

    const baseUrl = (baseUrlSetting?.value as string) || DEFAULT_OLLAMA_BASE_URL;
    const model = (modelSetting?.value as string) || DEFAULT_OLLAMA_MODEL;

    providerRef.current = new OllamaProvider(baseUrl, model);
    return providerRef.current;
  }, []);

  /**
   * Check connection status
   */
  const checkConnection = useCallback(async (): Promise<boolean> => {
    try {
      const provider = await getProvider();
      const connected = await provider.healthCheck();
      setIsConnected(connected);
      return connected;
    } catch (err) {
      logger.error('[AIChat] Connection check failed:', err);
      setIsConnected(false);
      return false;
    }
  }, [getProvider]);

  /**
   * Convert feature ChatMessage to lib ChatMessage format
   */
  const toLibChatMessage = useCallback((msg: ChatMessage): import('@/lib/ai/types').ChatMessage => {
    return {
      role: msg.role,
      content: msg.content,
      name: msg.name,
      toolCallId: msg.toolCallId,
      toolCalls: msg.toolCalls,
    };
  }, []);

  /**
   * Send a message and get AI response
   */
  const sendMessage = useCallback(
    async (content: string) => {
      // Check connection first
      const connected = await checkConnection();
      if (!connected) {
        setError('Cannot connect to AI service. Please check your settings.');
        setStatus('error');
        return;
      }

      // Create user message
      const userMessage: ChatMessage = {
        id: generateId(),
        role: 'user',
        content,
        createdAt: Date.now(),
      };

      // Add user message to state
      setMessages((prev) => [...prev, userMessage]);
      setStatus('loading');
      setError(null);

      try {
        const provider = await getProvider();

        // Prepare messages for API
        const systemPrompt = generateSystemPrompt();
        const apiMessages: import('@/lib/ai/types').ChatMessage[] = [
          { role: 'system', content: systemPrompt },
          ...messages.map(toLibChatMessage),
          toLibChatMessage(userMessage),
        ];

        // Get tool definitions
        const tools = toolRegistry.getToolDefinitions() as AIToolDefinition[];

        // Create abort controller for potential cancellation
        abortControllerRef.current = new AbortController();

        // For streaming response, we need a different approach
        const response = await provider.chat(apiMessages, {
          tools,
          stream: true,
          onChunk: (chunk) => {
            // Update the last assistant message with streaming content
            setMessages((prev) => {
              const lastMsg = prev[prev.length - 1];
              if (lastMsg?.role === 'assistant') {
                return [...prev.slice(0, -1), { ...lastMsg, content: lastMsg.content + chunk }];
              }
              // Create new assistant message
              return [
                ...prev,
                {
                  id: generateId(),
                  role: 'assistant',
                  content: chunk,
                  createdAt: Date.now(),
                },
              ];
            });
          },
        });

        setStatus('streaming');

        // Check if there are tool calls
        if (response.message.toolCalls && response.message.toolCalls.length > 0) {
          const toolCall = response.message.toolCalls[0];

          // Check if confirmation is required
          if (toolRegistry.requiresConfirmation(toolCall.function.name)) {
            // Set pending tool call for confirmation
            const args =
              typeof toolCall.function.arguments === 'string'
                ? JSON.parse(toolCall.function.arguments)
                : toolCall.function.arguments;

            setPendingToolCall({
              toolCall: {
                id: toolCall.id,
                type: toolCall.type,
                function: {
                  name: toolCall.function.name,
                  arguments: args,
                },
              },
              arguments: args,
            });
            setStatus('confirming');

            // Add tool call to the assistant message
            setMessages((prev) => {
              const lastMsg = prev[prev.length - 1];
              if (lastMsg?.role === 'assistant') {
                return [
                  ...prev.slice(0, -1),
                  {
                    ...lastMsg,
                    toolCalls: [toolCall],
                  },
                ];
              }
              return prev;
            });
          } else {
            // Execute tool directly
            await executeToolCallRef.current?.(toolCall, userMessage.id);
          }
        } else {
          setStatus('idle');
        }
      } catch (err) {
        logger.error('[AIChat] Chat error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setStatus('error');
      }
    },
    [messages, checkConnection, getProvider, toLibChatMessage]
  );

  /**
   * Execute a tool call
   */
  const executeToolCall = useCallback(
    async (toolCall: ToolCall, _userMessageId: string) => {
      setStatus('loading');

      try {
        // Parse arguments
        const args =
          typeof toolCall.function.arguments === 'string'
            ? JSON.parse(toolCall.function.arguments)
            : toolCall.function.arguments;

        logger.info(`[AIChat] Executing tool: ${toolCall.function.name}`, args);

        // Execute the tool
        const result = await toolRegistry.execute(
          toolCall.function.name,
          args as Record<string, unknown>
        );

        // Create tool result message
        const toolResultMessage: ChatMessage = {
          id: generateId(),
          role: 'tool',
          content: JSON.stringify(result, null, 2),
          toolCallId: toolCall.id,
          name: toolCall.function.name,
          createdAt: Date.now(),
        };

        setMessages((prev) => [...prev, toolResultMessage]);

        // Send result back to AI for final response
        await continueConversationRef.current?.([...messages, toolResultMessage]);
      } catch (err) {
        logger.error('[AIChat] Tool execution error:', err);

        // Create error tool result message
        const errorMessage: ChatMessage = {
          id: generateId(),
          role: 'tool',
          content: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
          toolCallId: toolCall.id,
          name: toolCall.function.name,
          createdAt: Date.now(),
        };

        setMessages((prev) => [...prev, errorMessage]);

        // Continue with error
        await continueConversationRef.current?.([...messages, errorMessage]);
      }
    },
    [messages, continueConversationRef]
  );

  /**
   * Continue conversation after tool execution
   */
  const continueConversation = useCallback(
    async (allMessages: ChatMessage[]) => {
      try {
        const provider = await getProvider();

        // Prepare messages
        const systemPrompt = generateSystemPrompt();
        const apiMessages: import('@/lib/ai/types').ChatMessage[] = [
          { role: 'system', content: systemPrompt },
          ...allMessages.map(toLibChatMessage),
        ];

        // Get response
        const response = await provider.chat(apiMessages, {
          stream: true,
          onChunk: (chunk) => {
            // Update or create assistant message
            setMessages((prev) => {
              const lastMsg = prev[prev.length - 1];
              if (lastMsg?.role === 'assistant' && !lastMsg.toolCalls) {
                return [...prev.slice(0, -1), { ...lastMsg, content: lastMsg.content + chunk }];
              }
              return [
                ...prev,
                {
                  id: generateId(),
                  role: 'assistant',
                  content: chunk,
                  createdAt: Date.now(),
                },
              ];
            });
          },
        });

        // Check for more tool calls
        if (response.message.toolCalls && response.message.toolCalls.length > 0) {
          const toolCall = response.message.toolCalls[0];

          if (toolRegistry.requiresConfirmation(toolCall.function.name)) {
            const args =
              typeof toolCall.function.arguments === 'string'
                ? JSON.parse(toolCall.function.arguments)
                : toolCall.function.arguments;

            setPendingToolCall({
              toolCall: {
                id: toolCall.id,
                type: toolCall.type,
                function: {
                  name: toolCall.function.name,
                  arguments: args,
                },
              },
              arguments: args,
            });
            setStatus('confirming');
          } else {
            await executeToolCallRef.current?.(toolCall, '');
          }
        } else {
          setStatus('idle');
        }
      } catch (err) {
        logger.error('[AIChat] Continue conversation error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setStatus('error');
      }
    },
    [getProvider, toLibChatMessage, executeToolCallRef]
  );

  /**
   * Confirm and execute pending tool call
   */
  const confirmToolCall = useCallback(async () => {
    if (!pendingToolCall) return;

    const { toolCall } = pendingToolCall;
    setPendingToolCall(null);

    // Add user confirmation message
    const confirmMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: `Confirmed: Execute ${toolCall.function.name}`,
      createdAt: Date.now(),
    };

    setMessages((prev) => [...prev, confirmMessage]);

    // Execute the tool
    await executeToolCall(toolCall, confirmMessage.id);
  }, [pendingToolCall, executeToolCall]);

  /**
   * Cancel pending tool call
   */
  const cancelToolCall = useCallback(() => {
    if (!pendingToolCall) return;

    const { toolCall } = pendingToolCall;

    // Add cancellation message
    const cancelMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: `Cancelled: ${toolCall.function.name}`,
      createdAt: Date.now(),
    };

    setMessages((prev) => [...prev, cancelMessage]);
    setPendingToolCall(null);
    setStatus('idle');
  }, [pendingToolCall]);

  /**
   * Clear all messages
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
    setStatus('idle');
    setError(null);
    setPendingToolCall(null);
  }, []);

  // Update refs after functions are defined to avoid circular dependencies
  useEffect(() => {
    executeToolCallRef.current = executeToolCall;
    continueConversationRef.current = continueConversation;
  });

  return {
    messages,
    status,
    error,
    isConnected,
    pendingToolCall,
    sendMessage,
    confirmToolCall,
    cancelToolCall,
    clearMessages,
    checkConnection,
  };
}
