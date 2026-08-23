import { useCallback, useEffect, useRef, useState } from 'react';
import { hasAssistantOutput } from '@/lib/ai/agentRuntime';
import type { ChatMessage } from '../types';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

interface UseAIChatMessagesReturn {
  messages: ChatMessage[];
  reasoning: string;
  messagesRef: React.MutableRefObject<ChatMessage[]>;
  setMessagesWithRef: (updater: (prev: ChatMessage[]) => ChatMessage[]) => void;
  appendMessages: (newMessages: ChatMessage[]) => ChatMessage[];
  createAssistantPlaceholder: () => void;
  handleStreamChunk: (chunk: string) => void;
  handleReasoningChunk: (chunk: string) => void;
  handleAssistantMessage: (assistantMessage: ChatMessage) => void;
  loadSessionMessages: (loadedMessages: ChatMessage[]) => void;
}

export function useAIChatMessages(): UseAIChatMessagesReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reasoning, setReasoning] = useState('');
  const messagesRef = useRef<ChatMessage[]>(messages);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

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

  const createAssistantPlaceholder = useCallback(() => {
    setReasoning('');
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

  const handleStreamChunk = useCallback(
    (chunk: string) => {
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
    [setMessagesWithRef]
  );

  const handleReasoningChunk = useCallback(
    (chunk: string) => {
      setReasoning((previous) => previous + chunk);
      setMessagesWithRef((prev) => {
        const lastMessage = prev[prev.length - 1];
        if (lastMessage?.role !== 'assistant') {
          return prev;
        }

        const previousReasoning = lastMessage.providerMetadata?.openAIReasoningContent || '';
        return [
          ...prev.slice(0, -1),
          {
            ...lastMessage,
            providerMetadata: {
              ...lastMessage.providerMetadata,
              openAIReasoningContent: previousReasoning + chunk,
            },
          },
        ];
      });
    },
    [setMessagesWithRef]
  );

  const handleAssistantMessage = useCallback(
    (assistantMessage: ChatMessage) => {
      setReasoning('');
      setMessagesWithRef((prev) => {
        if (!hasAssistantOutput(assistantMessage)) {
          const lastMessage = prev[prev.length - 1];
          return lastMessage?.role === 'assistant' && !hasAssistantOutput(lastMessage)
            ? prev.slice(0, -1)
            : prev;
        }

        const lastMsg = prev[prev.length - 1];
        if (lastMsg?.role === 'assistant') {
          return [...prev.slice(0, -1), { ...lastMsg, ...assistantMessage, id: lastMsg.id }];
        }

        return [...prev, assistantMessage];
      });
    },
    [setMessagesWithRef]
  );

  const loadSessionMessages = useCallback((loadedMessages: ChatMessage[]) => {
    messagesRef.current = loadedMessages;
    setMessages(loadedMessages);
  }, []);

  return {
    messages,
    reasoning,
    messagesRef,
    setMessagesWithRef,
    appendMessages,
    createAssistantPlaceholder,
    handleStreamChunk,
    handleReasoningChunk,
    handleAssistantMessage,
    loadSessionMessages,
  };
}
