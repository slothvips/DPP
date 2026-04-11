import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_CONFIGS } from '@/lib/ai/provider';
import type { AIProviderType } from '@/lib/ai/types';
import { logger } from '@/utils/logger';
import { loadAIConfig, loadProviderConfig, saveAIConfig } from '../lib/aiConfigStorage';

export function useAIConfigDialog(open: boolean, onSaved?: () => void) {
  const [provider, setProvider] = useState<AIProviderType>('custom');
  const [baseUrl, setBaseUrl] = useState<string>(DEFAULT_CONFIGS.custom.baseUrl);
  const [model, setModel] = useState<string>(DEFAULT_CONFIGS.custom.model);
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);

  const applyProviderConfig = useCallback(async (providerType: AIProviderType) => {
    const config = await loadProviderConfig(providerType);
    setProvider(config.provider);
    setBaseUrl(config.baseUrl);
    setModel(config.model);
    setApiKey(config.apiKey);
  }, []);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const config = await loadAIConfig();
      setProvider(config.provider);
      setBaseUrl(config.baseUrl);
      setModel(config.model);
      setApiKey(config.apiKey);
    } catch (err) {
      logger.error('[AIConfig] Failed to load config:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    void loadConfig();
  }, [loadConfig, open]);

  const handleProviderChange = useCallback(
    async (newProvider: AIProviderType) => {
      setProvider(newProvider);
      try {
        await applyProviderConfig(newProvider);
      } catch (err) {
        logger.error('[AIConfig] Failed to load provider config:', err);
      }
    },
    [applyProviderConfig]
  );

  const handleSave = useCallback(async () => {
    setLoading(true);
    try {
      await saveAIConfig({ provider, baseUrl, model, apiKey });
      onSaved?.();
      return true;
    } catch (err) {
      logger.error('[AIConfig] Failed to save config:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [apiKey, baseUrl, model, onSaved, provider]);

  return {
    provider,
    baseUrl,
    model,
    apiKey,
    loading,
    setBaseUrl,
    setModel,
    setApiKey,
    handleProviderChange,
    handleSave,
  };
}
