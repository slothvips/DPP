import { useCallback, useRef, useState } from 'react';
import { hasAssistantOutput } from '@/lib/ai/agentRuntime';
import type { ChatMessage } from '../types';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

interface UseAIChatMessagesReturn {
  messages: ChatMessage[];
  reasoning: string;
  messagesRef: React.MutableRefObject<ChatMessage[]>;
  getMessagesRef: (sessionId: string | null) => React.MutableRefObject<ChatMessage[]>;
  setActiveSession: (sessionId: string | null) => void;
  setMessagesWithRef: (
    sessionId: string | null,
    updater: (prev: ChatMessage[]) => ChatMessage[]
  ) => void;
  appendMessages: (sessionId: string | null, newMessages: ChatMessage[]) => ChatMessage[];
  createAssistantPlaceholder: (sessionId: string | null) => string | undefined;
  handleStreamChunk: (sessionId: string | null, assistantMessageId: string, chunk: string) => void;
  handleReasoningChunk: (
    sessionId: string | null,
    assistantMessageId: string,
    chunk: string
  ) => void;
  handleAssistantMessage: (
    sessionId: string | null,
    assistantMessageId: string,
    assistantMessage: ChatMessage
  ) => void;
  loadSessionMessages: (sessionId: string, loadedMessages: ChatMessage[]) => void;
}

export function useAIChatMessages(): UseAIChatMessagesReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reasoning, setReasoning] = useState('');
  const activeSessionIdRef = useRef<string | null>(null);
  const messagesBySessionRef = useRef(new Map<string, ChatMessage[]>());
  const messageRefsRef = useRef(new Map<string, React.MutableRefObject<ChatMessage[]>>());
  const reasoningBySessionRef = useRef(new Map<string, string>());
  const messagesRef = useRef<ChatMessage[]>(messages);

  const getMessagesRef = useCallback((sessionId: string | null) => {
    const id = sessionId || '';
    const existing = messageRefsRef.current.get(id);
    if (existing) return existing;
    const ref = { current: messagesBySessionRef.current.get(id) || [] };
    messageRefsRef.current.set(id, ref);
    return ref;
  }, []);

  const syncActiveSession = useCallback((sessionId: string | null) => {
    const next = sessionId ? messagesBySessionRef.current.get(sessionId) || [] : [];
    const nextReasoning = sessionId ? reasoningBySessionRef.current.get(sessionId) || '' : '';
    messagesRef.current = next;
    setMessages(next);
    setReasoning(nextReasoning);
  }, []);

  const setActiveSession = useCallback(
    (sessionId: string | null) => {
      activeSessionIdRef.current = sessionId;
      syncActiveSession(sessionId);
    },
    [syncActiveSession]
  );

  const setMessagesWithRef = useCallback(
    (sessionId: string | null, updater: (prev: ChatMessage[]) => ChatMessage[]) => {
      if (!sessionId) return;
      const ref = getMessagesRef(sessionId);
      const next = updater(ref.current);
      ref.current = next;
      messagesBySessionRef.current.set(sessionId, next);
      if (sessionId === activeSessionIdRef.current) {
        messagesRef.current = next;
        setMessages(next);
      }
    },
    [getMessagesRef]
  );

  const appendMessages = useCallback(
    (sessionId: string | null, newMessages: ChatMessage[]) => {
      if (newMessages.length === 0) {
        return sessionId ? getMessagesRef(sessionId).current : [];
      }

      const nextMessages = sessionId ? [...getMessagesRef(sessionId).current, ...newMessages] : [];
      setMessagesWithRef(sessionId, () => nextMessages);
      return nextMessages;
    },
    [getMessagesRef, setMessagesWithRef]
  );

  const createAssistantPlaceholder = useCallback(
    (sessionId: string | null) => {
      if (!sessionId) return undefined;
      const id = generateId();
      setMessagesWithRef(sessionId, (prev) => [
        ...prev,
        { id, role: 'assistant', content: '', createdAt: Date.now() },
      ]);
      reasoningBySessionRef.current.set(sessionId, '');
      if (sessionId === activeSessionIdRef.current) setReasoning('');
      return id;
    },
    [setMessagesWithRef]
  );

  const handleStreamChunk = useCallback(
    (sessionId: string | null, assistantMessageId: string, chunk: string) => {
      if (!sessionId) return;
      setMessagesWithRef(sessionId, (prev) => {
        const index = prev.findIndex((message) => message.id === assistantMessageId);
        if (index === -1) return prev;
        const message = prev[index];
        return [
          ...prev.slice(0, index),
          { ...message, content: message.content + chunk },
          ...prev.slice(index + 1),
        ];
      });
    },
    [setMessagesWithRef]
  );

  const handleReasoningChunk = useCallback(
    (sessionId: string | null, assistantMessageId: string, chunk: string) => {
      if (!sessionId) return;
      const reasoning = (reasoningBySessionRef.current.get(sessionId) || '') + chunk;
      reasoningBySessionRef.current.set(sessionId, reasoning);
      if (sessionId === activeSessionIdRef.current) setReasoning(reasoning);
      setMessagesWithRef(sessionId, (prev) => {
        const index = prev.findIndex((message) => message.id === assistantMessageId);
        if (index === -1) return prev;
        const lastMessage = prev[index];
        const previousReasoning = lastMessage.providerMetadata?.openAIReasoningContent || '';
        return [
          ...prev.slice(0, index),
          {
            ...lastMessage,
            providerMetadata: {
              ...lastMessage.providerMetadata,
              openAIReasoningContent: previousReasoning + chunk,
            },
          },
          ...prev.slice(index + 1),
        ];
      });
    },
    [setMessagesWithRef]
  );

  const handleAssistantMessage = useCallback(
    (sessionId: string | null, assistantMessageId: string, assistantMessage: ChatMessage) => {
      if (!sessionId) return;
      reasoningBySessionRef.current.set(sessionId, '');
      if (sessionId === activeSessionIdRef.current) setReasoning('');
      setMessagesWithRef(sessionId, (prev) => {
        if (!hasAssistantOutput(assistantMessage)) {
          return prev.filter((message) => message.id !== assistantMessageId);
        }
        const index = prev.findIndex((message) => message.id === assistantMessageId);
        if (index === -1) return [...prev, { ...assistantMessage, id: assistantMessageId }];
        return [
          ...prev.slice(0, index),
          { ...prev[index], ...assistantMessage, id: assistantMessageId },
          ...prev.slice(index + 1),
        ];
      });
    },
    [setMessagesWithRef]
  );

  const loadSessionMessages = useCallback(
    (sessionId: string, loadedMessages: ChatMessage[]) => {
      messagesBySessionRef.current.set(sessionId, loadedMessages);
      const ref = getMessagesRef(sessionId);
      ref.current = loadedMessages;
      if (sessionId === activeSessionIdRef.current) syncActiveSession(sessionId);
    },
    [getMessagesRef, syncActiveSession]
  );

  return {
    messages,
    reasoning,
    messagesRef,
    getMessagesRef,
    setActiveSession,
    setMessagesWithRef,
    appendMessages,
    createAssistantPlaceholder,
    handleStreamChunk,
    handleReasoningChunk,
    handleAssistantMessage,
    loadSessionMessages,
  };
}
