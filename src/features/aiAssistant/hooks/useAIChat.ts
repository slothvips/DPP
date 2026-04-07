// AI Chat hook - Core conversation logic
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { ensureAIToolsRegistered } from '@/lib/ai';
import { createConfiguredProvider } from '@/lib/ai/config';
import { generateSystemPrompt } from '@/lib/ai/prompt';
import { YOLO_MODE_KEY, toolRegistry } from '@/lib/ai/tools';
import type { AIProviderType, ModelProvider, OpenAIToolCall } from '@/lib/ai/types';
import {
  addMessage,
  clearSessionMessages,
  createSession,
  deleteSession as dbDeleteSession,
  getMessagesBySession,
  getMostRecentSession,
  getSession,
  listSessions,
  updateSessionTitle,
} from '@/lib/db/ai';
import { logger } from '@/utils/logger';
import type { AISession, ChatMessage } from '../types';

export type ToolCall = OpenAIToolCall;

interface PreparedToolCall {
  toolCall: ToolCall;
  arguments: Record<string, unknown>;
}

export type AIChatStatus = 'idle' | 'loading' | 'streaming' | 'error' | 'confirming';

export interface PendingToolCall {
  toolCall: ToolCall;
  arguments: Record<string, unknown>;
}

export interface PendingToolCalls {
  toolCalls: ToolCall[];
  argumentsList: Record<string, unknown>[];
}

export interface PendingBuild {
  jobUrl: string;
  jobName: string;
}

export interface UseAIChatReturn {
  messages: ChatMessage[];
  status: AIChatStatus;
  error: string | null;
  pendingToolCall: PendingToolCall | null;
  pendingToolCalls: PendingToolCalls | null;
  pendingBuild: PendingBuild | null;
  sessionId: string | null;
  sessions: AISession[];
  currentProvider: AIProviderType | null;
  yoloMode: boolean;
  setYoloMode: (value: boolean) => void;
  isRunning: boolean;
  sendMessage: (content: string) => Promise<void>;
  stop: () => void;
  confirmToolCall: () => Promise<void>;
  confirmAllToolCalls: () => Promise<void>;
  cancelToolCall: () => void;
  clearMessages: () => void;
  createNewSession: () => Promise<void>;
  switchSession: (id: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  resetProvider: () => void;
  completeBuild: () => void;
  cancelBuild: () => void;
  summarizeSession: () => Promise<string | null>;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function parseToolCallArguments(toolCall: ToolCall): Record<string, unknown> {
  const rawArgs = toolCall.function.arguments.trim();
  if (!rawArgs) {
    return {};
  }

  const parsed = JSON.parse(rawArgs) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Tool ${toolCall.function.name} arguments must be a JSON object`);
  }

  return parsed as Record<string, unknown>;
}

function prepareToolCalls(toolCalls: ToolCall[]): PreparedToolCall[] {
  return toolCalls.map((toolCall) => ({
    toolCall,
    arguments: parseToolCallArguments(toolCall),
  }));
}

export function useAIChat(): UseAIChatReturn {
  useEffect(() => {
    ensureAIToolsRegistered();
  }, []);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<AIChatStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [pendingToolCalls, setPendingToolCalls] = useState<PendingToolCalls | null>(null);
  const [pendingBuild, setPendingBuild] = useState<PendingBuild | null>(null);
  const buildCompletedRef = useRef(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<AISession[]>([]);
  const [currentProvider, setCurrentProvider] = useState<AIProviderType | null>(null);

  const [yoloMode, setYoloMode] = useState(false);
  const yoloModeRef = useRef(yoloMode);
  useEffect(() => {
    yoloModeRef.current = yoloMode;
  }, [yoloMode]);

  useEffect(() => {
    browser.storage.session
      .get(YOLO_MODE_KEY)
      .then((result) => {
        if (result[YOLO_MODE_KEY] === true) {
          setYoloMode(true);
        }
      })
      .catch(() => {});

    const listener = (changes: Record<string, { newValue?: unknown }>) => {
      if (changes[YOLO_MODE_KEY]) {
        setYoloMode(changes[YOLO_MODE_KEY].newValue === true);
      }
    };
    browser.storage.session.onChanged.addListener(listener);
    return () => {
      browser.storage.session.onChanged.removeListener(listener);
    };
  }, []);

  const providerRef = useRef<ModelProvider | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const accumulatedContentRef = useRef<string>('');
  const hasStreamedChunkRef = useRef(false);
  const isFirstMessageRef = useRef<boolean>(true);
  const messagesRef = useRef<ChatMessage[]>(messages);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const continueConversationRef = useRef<((allMessages: ChatMessage[]) => Promise<void>) | null>(
    null
  );

  const pendingToolCall = useMemo(
    () =>
      pendingToolCalls
        ? {
            toolCall: pendingToolCalls.toolCalls[0],
            arguments: pendingToolCalls.argumentsList[0] || {},
          }
        : null,
    [pendingToolCalls]
  );

  const setMessagesWithRef = useCallback((updater: (prev: ChatMessage[]) => ChatMessage[]) => {
    setMessages((prev) => {
      const next = updater(prev);
      messagesRef.current = next;
      return next;
    });
  }, []);

  const appendMessages = useCallback((newMessages: ChatMessage[]) => {
    if (newMessages.length === 0) {
      return messagesRef.current;
    }

    const nextMessages = [...messagesRef.current, ...newMessages];
    messagesRef.current = nextMessages;
    setMessages(nextMessages);
    return nextMessages;
  }, []);

  const getProvider = useCallback(async (): Promise<ModelProvider> => {
    if (providerRef.current) {
      return providerRef.current;
    }

    const configured = await createConfiguredProvider({
      includeLegacyFallback: true,
      logPrefix: '[AIChat]',
    });
    setCurrentProvider(configured.providerType);
    providerRef.current = configured.provider;

    return providerRef.current;
  }, []);

  const toLibChatMessage = useCallback((msg: ChatMessage): import('@/lib/ai/types').ChatMessage => {
    return {
      role: msg.role,
      content: msg.content,
      name: msg.name,
      toolCallId: msg.toolCallId,
      toolCalls: msg.toolCalls,
    };
  }, []);

  const createAssistantPlaceholder = useCallback(() => {
    setMessagesWithRef((prev) => {
      const lastMsg = prev[prev.length - 1];
      if (lastMsg?.role === 'assistant') {
        return prev;
      }
      return [
        ...prev,
        {
          id: generateId(),
          role: 'assistant',
          content: '',
          createdAt: Date.now(),
        },
      ];
    });
  }, [setMessagesWithRef]);

  const saveUserMessage = useCallback(
    async (message: ChatMessage) => {
      if (!sessionId) {
        return;
      }
      try {
        await addMessage({
          sessionId,
          role: 'user',
          content: message.content,
        });
      } catch (err) {
        logger.error('[AIChat] Failed to save user message:', err);
      }
    },
    [sessionId]
  );

  const saveAssistantMessage = useCallback(
    async (message: ChatMessage) => {
      if (!sessionId) {
        return;
      }
      try {
        await addMessage({
          sessionId,
          role: 'assistant',
          content: message.content,
          name: message.name,
          toolCalls: message.toolCalls,
        });
      } catch (err) {
        logger.error('[AIChat] Failed to save assistant message:', err);
      }
    },
    [sessionId]
  );

  const saveToolMessages = useCallback(
    async (toolMessages: ChatMessage[]) => {
      if (!sessionId || toolMessages.length === 0) {
        return;
      }

      await Promise.all(
        toolMessages.map(async (message) => {
          try {
            await addMessage({
              sessionId,
              role: 'tool',
              content: message.content,
              name: message.name,
              toolCallId: message.toolCallId,
            });
          } catch (err) {
            logger.error('[AIChat] Failed to save tool result:', err);
          }
        })
      );
    },
    [sessionId]
  );

  const executePreparedToolCalls = useCallback(async (preparedToolCalls: PreparedToolCall[]) => {
    ensureAIToolsRegistered();

    const toolMessages: ChatMessage[] = [];

    for (const preparedToolCall of preparedToolCalls) {
      const { toolCall, arguments: args } = preparedToolCall;

      try {
        logger.info(`[AIChat] Executing tool: ${toolCall.function.name}`, {
          args,
          availableTools: toolRegistry.getAll().map((tool) => tool.name),
        });
        const result = await toolRegistry.execute(toolCall.function.name, args);
        const resultObj = result as { action?: string; jobUrl?: string; jobName?: string };

        if (resultObj.action === 'open_build_dialog' && resultObj.jobUrl && resultObj.jobName) {
          return {
            toolMessages,
            pendingBuild: {
              jobUrl: resultObj.jobUrl,
              jobName: resultObj.jobName,
            },
          };
        }

        toolMessages.push({
          id: generateId(),
          role: 'tool',
          name: toolCall.function.name,
          toolCallId: toolCall.id,
          content: JSON.stringify(result, null, 2),
          createdAt: Date.now(),
        });
      } catch (err) {
        logger.error('[AIChat] Tool execution error:', err);
        toolMessages.push({
          id: generateId(),
          role: 'tool',
          name: toolCall.function.name,
          toolCallId: toolCall.id,
          content: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
          createdAt: Date.now(),
        });
      }
    }

    return {
      toolMessages,
      pendingBuild: null,
    };
  }, []);

  const processAssistantResponse = useCallback(
    async (assistantMessage: ChatMessage) => {
      const toolCalls = assistantMessage.toolCalls || [];
      if (toolCalls.length === 0) {
        setStatus('idle');
        return;
      }

      const toolCallsToConfirm: PreparedToolCall[] = [];
      const toolCallsToExecute: PreparedToolCall[] = [];

      for (const preparedToolCall of prepareToolCalls(toolCalls)) {
        const toolName = preparedToolCall.toolCall.function.name.trim();
        const resolvedTool = toolRegistry.get(toolName);
        if (!resolvedTool) {
          throw new Error(`Tool ${toolName} not found`);
        }

        const normalizedToolCall = {
          ...preparedToolCall,
          toolCall: {
            ...preparedToolCall.toolCall,
            function: {
              ...preparedToolCall.toolCall.function,
              name: resolvedTool.name,
            },
          },
        };

        if (!yoloModeRef.current && toolRegistry.requiresConfirmation(resolvedTool.name)) {
          toolCallsToConfirm.push(normalizedToolCall);
        } else {
          toolCallsToExecute.push(normalizedToolCall);
        }
      }

      if (toolCallsToExecute.length > 0) {
        setStatus('loading');
        const { toolMessages, pendingBuild: executablePendingBuild } =
          await executePreparedToolCalls(toolCallsToExecute);

        appendMessages(toolMessages);
        await saveToolMessages(toolMessages);

        if (executablePendingBuild) {
          setPendingBuild(executablePendingBuild);
          setStatus('confirming');
          return;
        }
      }

      if (toolCallsToConfirm.length > 0) {
        setPendingToolCalls({
          toolCalls: toolCallsToConfirm.map(({ toolCall }) => toolCall),
          argumentsList: toolCallsToConfirm.map(({ arguments: args }) => args),
        });
        setStatus('confirming');
        return;
      }

      await continueConversationRef.current?.(messagesRef.current);
    },
    [appendMessages, executePreparedToolCalls, saveToolMessages]
  );

  const loadSession = useCallback(async (id: string) => {
    const loadedMessages = await getMessagesBySession(id);
    setMessages(loadedMessages);
    setSessionId(id);
  }, []);

  const loadSessions = useCallback(async () => {
    const loadedSessions = await listSessions();
    setSessions(loadedSessions);
  }, []);

  const runChatCompletion = useCallback(
    async (apiMessages: import('@/lib/ai/types').ChatMessage[]) => {
      const provider = await getProvider();
      const systemPrompt = generateSystemPrompt();
      const tools = toolRegistry.getOpenAITools();

      accumulatedContentRef.current = '';
      hasStreamedChunkRef.current = false;
      createAssistantPlaceholder();

      abortControllerRef.current = new AbortController();

      const response = await provider.chat(
        [{ role: 'system', content: systemPrompt }, ...apiMessages],
        {
          stream: true,
          signal: abortControllerRef.current.signal,
          tools,
          toolChoice: tools.length ? 'auto' : 'none',
          onChunk: (chunk) => {
            if (!hasStreamedChunkRef.current) {
              hasStreamedChunkRef.current = true;
              setStatus('streaming');
            }
            accumulatedContentRef.current += chunk;
            setMessagesWithRef((prev) => {
              const lastMsg = prev[prev.length - 1];
              if (lastMsg?.role !== 'assistant') {
                return [
                  ...prev,
                  {
                    id: generateId(),
                    role: 'assistant',
                    content: chunk,
                    createdAt: Date.now(),
                  },
                ];
              }
              return [...prev.slice(0, -1), { ...lastMsg, content: lastMsg.content + chunk }];
            });
          },
        }
      );

      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: response.message.content || accumulatedContentRef.current,
        toolCalls: response.message.toolCalls,
        createdAt: Date.now(),
      };

      setMessagesWithRef((prev) => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg?.role === 'assistant') {
          return [...prev.slice(0, -1), { ...lastMsg, ...assistantMessage, id: lastMsg.id }];
        }
        return [...prev, assistantMessage];
      });

      await saveAssistantMessage(assistantMessage);
      return assistantMessage;
    },
    [createAssistantPlaceholder, getProvider, saveAssistantMessage, setMessagesWithRef]
  );

  const sendMessage = useCallback(
    async (content: string) => {
      const userMessage: ChatMessage = {
        id: generateId(),
        role: 'user',
        content,
        createdAt: Date.now(),
      };

      const nextMessages = appendMessages([userMessage]);
      setStatus('loading');
      setError(null);

      await saveUserMessage(userMessage);

      if (sessionId && isFirstMessageRef.current) {
        await updateSessionTitle(sessionId, content);
        isFirstMessageRef.current = false;
        await loadSessions();
      }

      try {
        const assistantMessage = await runChatCompletion([
          ...nextMessages.slice(0, -1).map(toLibChatMessage),
          toLibChatMessage(userMessage),
        ]);
        await processAssistantResponse(assistantMessage);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          setStatus('idle');
          return;
        }
        logger.error('[AIChat] Chat error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setStatus('error');
      }
    },
    [
      appendMessages,
      loadSessions,
      processAssistantResponse,
      runChatCompletion,
      saveUserMessage,
      sessionId,
      toLibChatMessage,
    ]
  );

  const continueConversation = useCallback(
    async (allMessages: ChatMessage[]) => {
      accumulatedContentRef.current = '';
      hasStreamedChunkRef.current = false;

      try {
        const assistantMessage = await runChatCompletion(allMessages.map(toLibChatMessage));
        await processAssistantResponse(assistantMessage);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          setStatus('idle');
          return;
        }
        logger.error('[AIChat] Continue conversation error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setStatus('error');
      }
    },
    [processAssistantResponse, runChatCompletion, toLibChatMessage]
  );

  continueConversationRef.current = continueConversation;

  const confirmToolCall = useCallback(async () => {
    if (!pendingToolCalls || pendingToolCalls.toolCalls.length === 0) {
      return;
    }

    const [currentToolCall, ...remainingToolCalls] = pendingToolCalls.toolCalls;
    const [currentArgs, ...remainingArguments] = pendingToolCalls.argumentsList;

    setPendingToolCalls(null);
    setStatus('loading');

    const { toolMessages, pendingBuild: confirmedPendingBuild } = await executePreparedToolCalls([
      {
        toolCall: currentToolCall,
        arguments: currentArgs || {},
      },
    ]);

    appendMessages(toolMessages);
    await saveToolMessages(toolMessages);

    if (confirmedPendingBuild) {
      setPendingBuild(confirmedPendingBuild);
      setStatus('confirming');
      return;
    }

    if (remainingToolCalls.length > 0) {
      setPendingToolCalls({
        toolCalls: remainingToolCalls,
        argumentsList: remainingArguments,
      });
      setStatus('confirming');
      return;
    }

    await continueConversationRef.current?.(messagesRef.current);
  }, [appendMessages, executePreparedToolCalls, pendingToolCalls, saveToolMessages]);

  const confirmAllToolCalls = useCallback(async () => {
    if (!pendingToolCalls) {
      return;
    }

    const preparedToolCalls = pendingToolCalls.toolCalls.map((toolCall, index) => ({
      toolCall,
      arguments: pendingToolCalls.argumentsList[index] || {},
    }));

    setPendingToolCalls(null);
    setStatus('loading');

    const { toolMessages, pendingBuild: confirmedPendingBuild } =
      await executePreparedToolCalls(preparedToolCalls);

    appendMessages(toolMessages);
    await saveToolMessages(toolMessages);

    if (confirmedPendingBuild) {
      setPendingBuild(confirmedPendingBuild);
      setStatus('confirming');
      return;
    }

    await continueConversationRef.current?.(messagesRef.current);
  }, [appendMessages, executePreparedToolCalls, pendingToolCalls, saveToolMessages]);

  const cancelToolCall = useCallback(() => {
    if (!pendingToolCall) {
      return;
    }

    const cancelMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: `已取消执行工具：${pendingToolCall.toolCall.function.name}${pendingToolCalls && pendingToolCalls.toolCalls.length > 1 ? `（以及另外 ${pendingToolCalls.toolCalls.length - 1} 个）` : ''}`,
      createdAt: Date.now(),
    };

    appendMessages([cancelMessage]);
    void saveUserMessage(cancelMessage);
    setPendingToolCalls(null);
    setStatus('idle');
  }, [appendMessages, pendingToolCall, pendingToolCalls, saveUserMessage]);

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    const stopMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: '任务已终止。',
      createdAt: Date.now(),
    };

    appendMessages([stopMessage]);
    void saveUserMessage(stopMessage);

    setPendingToolCalls(null);
    setPendingBuild(null);
    buildCompletedRef.current = false;
    setStatus('idle');
    setError(null);

    logger.info('[AIChat] AI task stopped by user');
  }, [appendMessages, saveUserMessage]);

  const clearMessages = useCallback(() => {
    if (sessionId) {
      void clearSessionMessages(sessionId);
    }
    setMessagesWithRef(() => []);
    setStatus('idle');
    setError(null);
    setPendingToolCalls(null);
    setPendingBuild(null);
    buildCompletedRef.current = false;
    accumulatedContentRef.current = '';
    hasStreamedChunkRef.current = false;
    isFirstMessageRef.current = true;
  }, [sessionId, setMessagesWithRef]);

  const createNewSession = useCallback(async () => {
    const session = await createSession('新会话');
    await loadSessions();
    await loadSession(session.id);
    isFirstMessageRef.current = true;
  }, [loadSession, loadSessions]);

  const switchSession = useCallback(
    async (id: string) => {
      setPendingToolCalls(null);
      setPendingBuild(null);
      buildCompletedRef.current = false;
      setError(null);
      setStatus('idle');
      await loadSession(id);
    },
    [loadSession]
  );

  const deleteSessionHandler = useCallback(
    async (id: string) => {
      await dbDeleteSession(id);
      await loadSessions();

      if (sessionId === id) {
        const remainingSessions = await listSessions();
        if (remainingSessions.length > 0) {
          await loadSession(remainingSessions[0].id);
        } else {
          await createNewSession();
        }
      }
    },
    [createNewSession, loadSession, loadSessions, sessionId]
  );

  const resetProvider = useCallback(() => {
    providerRef.current = null;
    setCurrentProvider(null);
    logger.info('[AIChat] Provider cache reset');
  }, []);

  const completeBuild = useCallback(() => {
    if (!pendingBuild) {
      return;
    }

    buildCompletedRef.current = true;

    const successMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: `[jenkins_trigger_build] 构建已成功触发: ${pendingBuild.jobName}`,
      createdAt: Date.now(),
    };

    appendMessages([successMessage]);
    void saveUserMessage(successMessage);

    setPendingBuild(null);
    setStatus('idle');

    void continueConversationRef.current?.(messagesRef.current);
  }, [appendMessages, pendingBuild, saveUserMessage]);

  const cancelBuild = useCallback(() => {
    if (buildCompletedRef.current) {
      buildCompletedRef.current = false;
      return;
    }

    if (!pendingBuild) {
      return;
    }

    const cancelMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: `[jenkins_trigger_build] 用户取消了构建: ${pendingBuild.jobName}`,
      createdAt: Date.now(),
    };

    appendMessages([cancelMessage]);
    void saveUserMessage(cancelMessage);

    setPendingBuild(null);
    setStatus('idle');
  }, [appendMessages, pendingBuild, saveUserMessage]);

  const summarizeSession = useCallback(async (): Promise<string | null> => {
    if (!sessionId) {
      logger.warn('[AIChat] Cannot compress: no session ID');
      return null;
    }

    const allMessages = await getMessagesBySession(sessionId);
    if (allMessages.length === 0) {
      logger.warn('[AIChat] Cannot compress: no messages in session');
      return null;
    }

    const compressedMessages = allMessages
      .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
      .map((msg) => {
        const roleLabel = msg.role === 'user' ? '用户' : '助手';
        return `${roleLabel}: ${msg.content}`;
      })
      .join('\n\n');

    const toolCallCount = allMessages.filter((msg) => msg.role === 'tool').length;

    try {
      const currentSession = await getSession(sessionId);
      const oldTitle = currentSession?.title || '会话';

      const newSession = await createSession(`${oldTitle}(已压缩)`);

      await addMessage({
        sessionId: newSession.id,
        role: 'assistant',
        content: `【压缩说明】
本会话已对原始对话进行压缩处理：
- 跳过了 ${toolCallCount} 条工具调用结果（AI 的反馈中已包含关键信息）
- 保留了用户问题和 AI 的最终回应

【对话概要】
${compressedMessages.slice(0, 2000)}${compressedMessages.length > 2000 ? '\n\n(对话过长，已截断)' : ''}`,
      });

      if (compressedMessages.length <= 4000) {
        await addMessage({
          sessionId: newSession.id,
          role: 'assistant',
          content: `【完整对话（压缩后）】\n\n${compressedMessages}`,
        });
      }

      await loadSessions();

      logger.info('[AIChat] Session compressed successfully', {
        oldSessionId: sessionId,
        newSessionId: newSession.id,
        originalMessageCount: allMessages.length,
        toolCallCount,
      });

      return newSession.id;
    } catch (err) {
      logger.error('[AIChat] Failed to compress session:', err);
      return null;
    }
  }, [loadSessions, sessionId]);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      if (!mounted) {
        return;
      }

      const savedSessionId = sessionStorage.getItem('ai_current_session_id');
      if (savedSessionId) {
        const session = await getSession(savedSessionId);
        if (session && mounted) {
          await loadSession(savedSessionId);
          return;
        }
      }

      await loadSessions();

      const recentSession = await getMostRecentSession();
      if (!mounted) {
        return;
      }
      if (recentSession) {
        await loadSession(recentSession.id);
      } else {
        await createNewSession();
      }
    };

    void init();
    return () => {
      mounted = false;
    };
  }, [createNewSession, loadSession, loadSessions]);

  useEffect(() => {
    if (sessionId) {
      sessionStorage.setItem('ai_current_session_id', sessionId);
    }
  }, [sessionId]);

  return {
    messages,
    status,
    error,
    pendingToolCall,
    pendingToolCalls,
    pendingBuild,
    sessionId,
    sessions,
    currentProvider,
    yoloMode,
    isRunning: status === 'loading' || status === 'streaming',
    sendMessage,
    stop,
    confirmToolCall,
    confirmAllToolCalls,
    cancelToolCall,
    clearMessages,
    createNewSession,
    switchSession,
    deleteSession: deleteSessionHandler,
    resetProvider,
    completeBuild,
    cancelBuild,
    summarizeSession,
    setYoloMode,
  };
}
