import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../types';

export function useAIAssistantScroll(messages: ChatMessage[]) {
  const [isNearBottom, setIsNearBottom] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) {
      return;
    }

    const { scrollTop, scrollHeight, clientHeight } = container;
    setIsNearBottom(scrollHeight - scrollTop - clientHeight < 100);
  }, []);

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      setIsNearBottom(true);
    }
  }, []);

  useEffect(() => {
    if (isNearBottom && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isNearBottom, messages]);

  return {
    isNearBottom,
    messagesEndRef,
    messagesContainerRef,
    handleScroll,
    scrollToBottom,
  };
}
