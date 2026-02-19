// AI Chat hook - Core conversation logic
import { useCallback, useEffect, useRef, useState } from 'react';
import { db } from '@/db';
// Import AI module to trigger tool registration
import '@/lib/ai';
import { generateSystemPrompt } from '@/lib/ai/prompt';
import { DEFAULT_CONFIGS, createProvider } from '@/lib/ai/provider';
import { containsToolCall, parseResponse } from '@/lib/ai/response-parser';
import { toolRegistry } from '@/lib/ai/tools';
import type { AIProviderType, ModelProvider } from '@/lib/ai/types';
import { decryptData, loadKey } from '@/lib/crypto/encryption';
import {
  addMessage,
  clearSessionMessages,
  createSession,
  deleteSession as dbDeleteSession,
  getMessagesBySession,
  getMostRecentSession,
  listSessions,
  updateSessionTitle,
} from '@/lib/db/ai';
import { logger } from '@/utils/logger';
import type { AISession, ChatMessage } from '../types';

/**
 * Tool call representation for internal use
 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string | Record<string, unknown>;
  };
}

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
 * Multiple pending tool calls that require confirmation
 */
export interface PendingToolCalls {
  toolCalls: ToolCall[];
  argumentsList: Record<string, unknown>[];
}

/**
 * useAIChat hook return type
 */
export interface UseAIChatReturn {
  // State
  messages: ChatMessage[];
  status: AIChatStatus;
  error: string | null;
  pendingToolCall: PendingToolCall | null;
  pendingToolCalls: PendingToolCalls | null;
  sessionId: string | null;
  sessions: AISession[];

  // Actions
  sendMessage: (content: string) => Promise<void>;
  confirmToolCall: () => Promise<void>;
  confirmAllToolCalls: () => Promise<void>;
  cancelToolCall: () => void;
  clearMessages: () => void;
  createNewSession: () => Promise<void>;
  switchSession: (id: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
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
  const [pendingToolCall, setPendingToolCall] = useState<PendingToolCall | null>(null);
  const [pendingToolCalls, setPendingToolCalls] = useState<PendingToolCalls | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<AISession[]>([]);

  // Refs
  const providerRef = useRef<ModelProvider | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const accumulatedContentRef = useRef<string>('');
  const isFirstMessageRef = useRef<boolean>(true);

  // Store callbacks in refs to avoid circular dependency warnings
  const executeToolCallRef = useRef<
    ((toolCall: ToolCall, userMessageId: string) => Promise<void>) | null
  >(null);
  const executeToolCallsRef = useRef<
    ((toolCalls: ToolCall[], userMessageId: string) => Promise<void>) | null
  >(null);
  const continueConversationRef = useRef<((allMessages: ChatMessage[]) => Promise<void>) | null>(
    null
  );

  /**
   * Initialize or get the AI provider
   */
  const getProvider = useCallback(async (): Promise<ModelProvider> => {
    if (providerRef.current) {
      return providerRef.current;
    }

    // Get config from settings
    const providerTypeSetting = await db.settings.where('key').equals('ai_provider_type').first();
    const baseUrlSetting = await db.settings.where('key').equals('ai_base_url').first();
    const modelSetting = await db.settings.where('key').equals('ai_model').first();
    const apiKeySetting = await db.settings.where('key').equals('ai_api_key').first();

    const providerType = (providerTypeSetting?.value as AIProviderType) || 'ollama';
    const defaults = DEFAULT_CONFIGS[providerType];
    const baseUrl = (baseUrlSetting?.value as string) || (defaults?.baseUrl as string) || '';
    const model = (modelSetting?.value as string) || (defaults?.model as string) || '';

    // Decrypt API key if present
    let apiKey = '';
    if (apiKeySetting?.value) {
      try {
        const encryptionKey = await loadKey();
        if (encryptionKey) {
          const decrypted = await decryptData(
            apiKeySetting.value as { ciphertext: string; iv: string },
            encryptionKey
          );
          apiKey = decrypted as string;
        } else {
          // Fallback: use raw value
          apiKey = apiKeySetting.value as string;
        }
      } catch (err) {
        logger.error('[AIChat] Failed to decrypt API key:', err);
      }
    }

    providerRef.current = createProvider(providerType, baseUrl, model, apiKey);
    return providerRef.current;
  }, []);

  /**
   * Convert feature ChatMessage to lib ChatMessage format
   */
  const toLibChatMessage = useCallback((msg: ChatMessage): import('@/lib/ai/types').ChatMessage => {
    return {
      role: msg.role,
      content: msg.content,
    };
  }, []);

  /**
   * Process accumulated content to check for tool calls
   */
  const processToolCall = useCallback(async (content: string, userMessageId: string) => {
    // Check if content contains any tool calls
    if (!containsToolCall(content)) {
      setStatus('idle');
      return;
    }

    const parsed = parseResponse(content);

    if (parsed.toolCalls && parsed.toolCalls.length > 0) {
      // Separate tool calls into those needing confirmation and those that can execute directly
      const toolCallsToConfirm: { toolCall: ToolCall; arguments: Record<string, unknown> }[] = [];
      const toolCallsToExecute: ToolCall[] = [];

      for (const { name, arguments: args } of parsed.toolCalls) {
        const toolCall: ToolCall = {
          id: generateId(),
          type: 'function',
          function: {
            name,
            arguments: args,
          },
        };

        // Check if confirmation is required
        if (toolRegistry.requiresConfirmation(name)) {
          toolCallsToConfirm.push({ toolCall, arguments: args });
        } else {
          toolCallsToExecute.push(toolCall);
        }
      }

      // If there are tool calls needing confirmation
      if (toolCallsToConfirm.length > 0) {
        if (toolCallsToExecute.length > 0) {
          // Execute non-confirming tools first (all results sent together), then set pending for confirming tools
          await executeToolCallsRef.current?.(toolCallsToExecute, userMessageId);
        }

        setPendingToolCalls({
          toolCalls: toolCallsToConfirm.map((t) => t.toolCall),
          argumentsList: toolCallsToConfirm.map((t) => t.arguments),
        });
        setPendingToolCall({
          toolCall: toolCallsToConfirm[0].toolCall,
          arguments: toolCallsToConfirm[0].arguments,
        });
        setStatus('confirming');
      } else {
        // No confirmation needed, execute all tool calls and send results together
        await executeToolCallsRef.current?.(toolCallsToExecute, userMessageId);
      }
    } else {
      setStatus('idle');
    }
  }, []);

  /**
   * Load session data
   */
  const loadSession = useCallback(async (id: string) => {
    const loadedMessages = await getMessagesBySession(id);
    setMessages(loadedMessages);
    setSessionId(id);
  }, []);

  /**
   * Load sessions list
   */
  const loadSessions = useCallback(async () => {
    const loadedSessions = await listSessions();
    setSessions(loadedSessions);
  }, []);

  /**
   * Send a message and get AI response
   */
  const sendMessage = useCallback(
    async (content: string) => {
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

      // Reset accumulated content
      accumulatedContentRef.current = '';

      // Save user message to database
      if (sessionId) {
        await addMessage({
          sessionId,
          role: 'user',
          content,
        });

        // Update session title on first message
        if (isFirstMessageRef.current) {
          await updateSessionTitle(sessionId, content);
          isFirstMessageRef.current = false;
          await loadSessions();
        }
      }

      try {
        const provider = await getProvider();

        // Prepare messages for API (tools are now in the system prompt)
        const systemPrompt = generateSystemPrompt();
        const apiMessages: import('@/lib/ai/types').ChatMessage[] = [
          { role: 'system', content: systemPrompt },
          ...messages.map(toLibChatMessage),
          toLibChatMessage(userMessage),
        ];

        // Create abort controller for potential cancellation
        abortControllerRef.current = new AbortController();

        // For streaming response (tool calls are parsed from content, not API response)
        await provider.chat(apiMessages, {
          stream: true,
          onChunk: (chunk) => {
            // Accumulate content for tool call detection
            accumulatedContentRef.current += chunk;

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

        // Save assistant message to database after streaming completes
        // Use accumulatedContentRef which has the complete response
        if (sessionId && accumulatedContentRef.current) {
          addMessage({
            sessionId,
            role: 'assistant',
            content: accumulatedContentRef.current,
          }).catch((err) => logger.error('[AIChat] Failed to save assistant message:', err));
        }

        // Check accumulated content for tool calls
        await processToolCall(accumulatedContentRef.current, userMessage.id);
      } catch (err) {
        logger.error('[AIChat] Chat error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setStatus('error');
      }
    },
    [messages, sessionId, getProvider, toLibChatMessage, processToolCall, loadSessions]
  );

  /**
   * Execute a single tool call
   */
  const executeToolCall = useCallback(
    async (toolCall: ToolCall, _userMessageId: string) => {
      setStatus('loading');

      try {
        // Get arguments - already parsed from JSON format
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
        // Note: We use role 'user' and include tool name in content for text-based tool calling
        const toolResultMessage: ChatMessage = {
          id: generateId(),
          role: 'user',
          content: `[${toolCall.function.name}] ${JSON.stringify(result, null, 2)}`,
          createdAt: Date.now(),
        };

        setMessages((prev) => [...prev, toolResultMessage]);

        // Save tool result to database
        if (sessionId) {
          addMessage({
            sessionId,
            role: 'user',
            content: toolResultMessage.content,
          }).catch((err) => logger.error('[AIChat] Failed to save tool result:', err));
        }

        // Send result back to AI for final response
        await continueConversationRef.current?.([...messages, toolResultMessage]);
      } catch (err) {
        logger.error('[AIChat] Tool execution error:', err);

        // Create error tool result message
        const errorMessage: ChatMessage = {
          id: generateId(),
          role: 'user',
          content: `[${toolCall.function.name}] Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
          createdAt: Date.now(),
        };

        setMessages((prev) => [...prev, errorMessage]);

        // Save error to database
        if (sessionId) {
          addMessage({
            sessionId,
            role: 'user',
            content: errorMessage.content,
          }).catch((err) => logger.error('[AIChat] Failed to save error:', err));
        }

        // Continue with error
        await continueConversationRef.current?.([...messages, errorMessage]);
      }
    },
    [messages, sessionId, continueConversationRef]
  );

  /**
   * Execute multiple tool calls in sequence and collect all results
   */
  const executeToolCalls = useCallback(
    async (toolCalls: ToolCall[], _userMessageId: string) => {
      setStatus('loading');
      const toolResultMessages: ChatMessage[] = [];

      // Execute each tool call in sequence and collect results
      for (const toolCall of toolCalls) {
        try {
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
            role: 'user',
            content: `[${toolCall.function.name}] ${JSON.stringify(result, null, 2)}`,
            createdAt: Date.now(),
          };

          toolResultMessages.push(toolResultMessage);
        } catch (err) {
          logger.error('[AIChat] Tool execution error:', err);

          // Create error tool result message
          const errorMessage: ChatMessage = {
            id: generateId(),
            role: 'user',
            content: `[${toolCall.function.name}] Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
            createdAt: Date.now(),
          };

          toolResultMessages.push(errorMessage);
        }
      }

      // Add all tool result messages to state
      setMessages((prev) => [...prev, ...toolResultMessages]);

      // Save all tool results to database
      if (sessionId) {
        await Promise.all(
          toolResultMessages.map((msg) =>
            addMessage({
              sessionId,
              role: msg.role,
              content: msg.content,
            }).catch((err) => logger.error('[AIChat] Failed to save tool result:', err))
          )
        );
      }

      // Send all results together to the model
      await continueConversationRef.current?.([...messages, ...toolResultMessages]);
    },
    [messages, sessionId, continueConversationRef]
  );

  /**
   * Continue conversation after tool execution
   */
  const continueConversation = useCallback(
    async (allMessages: ChatMessage[]) => {
      // Reset accumulated content for the next response
      accumulatedContentRef.current = '';

      try {
        const provider = await getProvider();

        // Prepare messages (tools are in system prompt)
        const systemPrompt = generateSystemPrompt();
        const apiMessages: import('@/lib/ai/types').ChatMessage[] = [
          { role: 'system', content: systemPrompt },
          ...allMessages.map(toLibChatMessage),
        ];

        // Get response (tool calls are parsed from content, not API response)
        await provider.chat(apiMessages, {
          stream: true,
          onChunk: (chunk) => {
            // Accumulate content
            accumulatedContentRef.current += chunk;

            // Update or create assistant message
            setMessages((prev) => {
              const lastMsg = prev[prev.length - 1];
              if (lastMsg?.role === 'assistant') {
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

        // Save assistant message to database after streaming completes
        if (sessionId && accumulatedContentRef.current) {
          addMessage({
            sessionId,
            role: 'assistant',
            content: accumulatedContentRef.current,
          }).catch((err) => logger.error('[AIChat] Failed to save assistant message:', err));
        }

        // Check for tool calls in accumulated content
        await processToolCall(accumulatedContentRef.current, '');
      } catch (err) {
        logger.error('[AIChat] Continue conversation error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setStatus('error');
      }
    },
    [getProvider, toLibChatMessage, processToolCall, sessionId]
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

    // Save confirmation to database
    if (sessionId) {
      addMessage({
        sessionId,
        role: 'user',
        content: confirmMessage.content,
      }).catch((err) => logger.error('[AIChat] Failed to save confirmation:', err));
    }

    // Execute the tool
    await executeToolCall(toolCall, confirmMessage.id);
  }, [pendingToolCall, sessionId, executeToolCall]);

  /**
   * Confirm and execute all pending tool calls
   */
  const confirmAllToolCalls = useCallback(async () => {
    if (!pendingToolCalls) return;

    const { toolCalls } = pendingToolCalls;

    // Add user confirmation message
    const confirmMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: `Confirmed: Execute ${toolCalls.length} tool call(s)`,
      createdAt: Date.now(),
    };

    setMessages((prev) => [...prev, confirmMessage]);

    // Save confirmation to database
    if (sessionId) {
      addMessage({
        sessionId,
        role: 'user',
        content: confirmMessage.content,
      }).catch((err) => logger.error('[AIChat] Failed to save confirmation:', err));
    }

    // Clear pending tool calls
    setPendingToolCalls(null);
    setPendingToolCall(null);

    // Execute all tools in sequence
    await executeToolCalls(toolCalls, confirmMessage.id);
  }, [pendingToolCalls, sessionId, executeToolCalls]);

  /**
   * Cancel pending tool call(s)
   */
  const cancelToolCall = useCallback(() => {
    const toolCall = pendingToolCall?.toolCall || pendingToolCalls?.toolCalls[0];

    if (!toolCall) return;

    // Add cancellation message
    const cancelMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: `Cancelled: ${toolCall.function.name}${pendingToolCalls && pendingToolCalls.toolCalls.length > 1 ? ` and ${pendingToolCalls.toolCalls.length - 1} other(s)` : ''}`,
      createdAt: Date.now(),
    };

    setMessages((prev) => [...prev, cancelMessage]);

    // Save cancellation to database
    if (sessionId) {
      addMessage({
        sessionId,
        role: 'user',
        content: cancelMessage.content,
      }).catch((err) => logger.error('[AIChat] Failed to save cancellation:', err));
    }

    setPendingToolCall(null);
    setPendingToolCalls(null);
    setStatus('idle');
  }, [pendingToolCall, pendingToolCalls, sessionId]);

  /**
   * Clear all messages in current session
   */
  const clearMessages = useCallback(() => {
    if (sessionId) {
      clearSessionMessages(sessionId);
    }
    setMessages([]);
    setStatus('idle');
    setError(null);
    setPendingToolCall(null);
    setPendingToolCalls(null);
    accumulatedContentRef.current = '';
    isFirstMessageRef.current = true;
  }, [sessionId]);

  /**
   * Create a new session and switch to it
   */
  const createNewSession = useCallback(async () => {
    const session = await createSession('新会话');
    await loadSessions();
    await loadSession(session.id);
    isFirstMessageRef.current = true;
  }, [loadSession, loadSessions]);

  /**
   * Switch to an existing session
   */
  const switchSession = useCallback(
    async (id: string) => {
      await loadSession(id);
    },
    [loadSession]
  );

  /**
   * Delete a session
   */
  const deleteSessionHandler = useCallback(
    async (id: string) => {
      await dbDeleteSession(id);
      await loadSessions();

      // If deleting current session, switch to another or create new
      if (sessionId === id) {
        const remainingSessions = await listSessions();
        if (remainingSessions.length > 0) {
          await loadSession(remainingSessions[0].id);
        } else {
          // Create new session if no sessions remain
          await createNewSession();
        }
      }
    },
    [sessionId, loadSession, loadSessions, createNewSession]
  );

  // Initialize sessions on mount
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      if (!mounted) return;
      await loadSessions();
      const recentSession = await getMostRecentSession();
      if (!mounted) return;
      if (recentSession) {
        // Check if the recent session has messages
        const messages = await getMessagesBySession(recentSession.id);
        if (messages.length > 0) {
          // Has messages, create a new session
          await createNewSession();
        } else {
          // Empty session, continue using it
          await loadSession(recentSession.id);
        }
      } else {
        // Create initial session if none exists
        await createNewSession();
      }
    };
    init();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update refs after functions are defined to avoid circular dependencies
  useEffect(() => {
    executeToolCallRef.current = executeToolCall;
    executeToolCallsRef.current = executeToolCalls;
    continueConversationRef.current = continueConversation;
  });

  return {
    messages,
    status,
    error,
    pendingToolCall,
    pendingToolCalls,
    sessionId,
    sessions,
    sendMessage,
    confirmToolCall,
    confirmAllToolCalls,
    cancelToolCall,
    clearMessages,
    createNewSession,
    switchSession,
    deleteSession: deleteSessionHandler,
  };
}
