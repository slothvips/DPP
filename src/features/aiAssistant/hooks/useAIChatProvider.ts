import { useCallback, useRef, useState } from 'react';
import { createConfiguredProvider } from '@/lib/ai/config';
import type { AIProviderType, ModelProvider } from '@/lib/ai/types';

interface UseAIChatProviderReturn {
  currentProvider: AIProviderType | null;
  currentProviderName: string | null;
  currentModel: string | null;
  getProvider: () => Promise<ModelProvider>;
  resetProvider: () => void;
}

export function useAIChatProvider(): UseAIChatProviderReturn {
  const [currentProvider, setCurrentProvider] = useState<AIProviderType | null>(null);
  const [currentProviderName, setCurrentProviderName] = useState<string | null>(null);
  const [currentModel, setCurrentModel] = useState<string | null>(null);
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
    setCurrentProviderName(configured.displayName);
    setCurrentModel(configured.provider.getModelName());
    providerRef.current = configured.provider;

    return providerRef.current;
  }, []);

  const resetProvider = useCallback(() => {
    providerRef.current = null;
    setCurrentProvider(null);
    setCurrentProviderName(null);
    setCurrentModel(null);
  }, []);

  return {
    currentProvider,
    currentProviderName,
    currentModel,
    getProvider,
    resetProvider,
  };
}
