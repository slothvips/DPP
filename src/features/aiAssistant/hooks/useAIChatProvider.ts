import { useCallback, useEffect, useRef, useState } from 'react';
import { createConfiguredProvider, loadAIProviderConfig } from '@/lib/ai/config';
import type { AIProviderConfig } from '@/lib/ai/config';
import type { AIProviderType, ModelProvider } from '@/lib/ai/types';
import { logger } from '@/utils/logger';

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

  const applyConfig = useCallback((config: AIProviderConfig) => {
    setCurrentProvider(config.providerType);
    setCurrentProviderName(config.displayName);
    setCurrentModel(config.model || null);
  }, []);

  const refreshConfig = useCallback(async () => {
    try {
      applyConfig(
        await loadAIProviderConfig({ includeLegacyFallback: true, logPrefix: '[AIChat]' })
      );
    } catch (error) {
      logger.error('[AIChat] Failed to load current provider config:', error);
    }
  }, [applyConfig]);

  useEffect(() => {
    void refreshConfig();
  }, [refreshConfig]);

  const getProvider = useCallback(async (): Promise<ModelProvider> => {
    if (providerRef.current) {
      return providerRef.current;
    }

    const configured = await createConfiguredProvider({
      includeLegacyFallback: true,
      logPrefix: '[AIChat]',
    });
    applyConfig({ ...configured, model: configured.provider.getModelName() });
    providerRef.current = configured.provider;

    return providerRef.current;
  }, [applyConfig]);

  const resetProvider = useCallback(() => {
    providerRef.current = null;
    void refreshConfig();
  }, [refreshConfig]);

  return {
    currentProvider,
    currentProviderName,
    currentModel,
    getProvider,
    resetProvider,
  };
}
