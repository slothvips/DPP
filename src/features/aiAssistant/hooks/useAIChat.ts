// AI Chat hook - Core conversation logic
import type { UseAIChatReturn } from './useAIChat.types';
import { useAIChatFacade } from './useAIChatFacade';

export type { UseAIChatReturn } from './useAIChat.types';

export function useAIChat(): UseAIChatReturn {
  return useAIChatFacade();
}
