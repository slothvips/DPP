import { useCallback, useRef, useState } from 'react';
import type { ChatMessage } from '../types';
import type { AIChatStatus } from './useAIChat.types';

export function useAIChatState() {
  const [status, setStatus] = useState<AIChatStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const isFirstMessageRef = useRef(true);
  const continueConversationRef = useRef<((allMessages: ChatMessage[]) => Promise<void>) | null>(
    null
  );

  const resetSessionScopedState = useCallback(() => {
    setError(null);
    setStatus('idle');
  }, []);

  const resetFirstMessageFlag = useCallback(() => {
    isFirstMessageRef.current = true;
  }, []);

  return {
    status,
    error,
    setStatus,
    setError,
    isFirstMessageRef,
    continueConversationRef,
    resetSessionScopedState,
    resetFirstMessageFlag,
    isRunning: status === 'loading' || status === 'streaming',
  };
}
