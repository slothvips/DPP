import { useCallback, useRef, useState } from 'react';
import { createConfiguredProvider } from '@/lib/ai/config';
import type { AIProviderType, ModelProvider } from '@/lib/ai/types';

interface UseAIChatProviderReturn {
  currentProvider: AIProviderType | null;
  getProvider: () => Promise<ModelProvider>;
  resetProvider: () => void;
}

export function useAIChatProvider(): UseAIChatProviderReturn {
  const [currentProvider, setCurrentProvider] = useState<AIProviderType | null>(null);
  const providerRef = useRef<ModelProvider | null>(null);

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

  const resetProvider = useCallback(() => {
    providerRef.current = null;
    setCurrentProvider(null);
  }, []);

  return {
    currentProvider,
    getProvider,
    resetProvider,
  };
}
