import { useCallback, useEffect, useState } from 'react';
import { checkOpenCodeModels } from '@/lib/ai/openCodeProviderModels';
import { DEFAULT_CONFIGS, createProvider } from '@/lib/ai/provider';
import { DEFAULT_AI_PROVIDER } from '@/lib/ai/providerIds';
import type { AIProviderType, Model } from '@/lib/ai/types';
import { logger } from '@/utils/logger';
import { toConfigProvider } from '../components/aiConfigDialogShared';
import {
  type AIProfileSummary,
  activateAIProfile,
  createAIProfile,
  loadAIConfig,
  loadAIProfiles,
  loadProviderConfig,
  saveAIConfig,
  updateAIProfile,
} from '../lib/aiConfigStorage';

export function useAIConfigDialog(open: boolean, onSaved?: () => void) {
  const [provider, setProvider] = useState<AIProviderType>(DEFAULT_AI_PROVIDER);
  const [baseUrl, setBaseUrl] = useState(DEFAULT_CONFIGS[DEFAULT_AI_PROVIDER].baseUrl);
  const [model, setModel] = useState(DEFAULT_CONFIGS[DEFAULT_AI_PROVIDER].model);
  const [contextWindow, setContextWindow] = useState<number | undefined>();
  const [apiKey, setApiKey] = useState('');
  const [profileName, setProfileName] = useState('');
  const [profiles, setProfiles] = useState<AIProfileSummary[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [modelOptions, setModelOptions] = useState<Model[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelLoadError, setModelLoadError] = useState<string | null>(null);

  const applyLoadedConfig = useCallback(
    async (config: Awaited<ReturnType<typeof loadAIConfig>>) => {
      const uiProvider = toConfigProvider(config.provider);
      const nextProfiles = await loadAIProfiles();
      const matchingProfile = nextProfiles.find(
        (profile) =>
          profile.provider === uiProvider &&
          profile.baseUrl === config.baseUrl &&
          profile.model === config.model
      );
      setProvider(uiProvider);
      setBaseUrl(config.baseUrl);
      setModel(config.model);
      setContextWindow(config.contextWindow);
      setApiKey(config.apiKey);
      setProfiles(nextProfiles);
      setSelectedProfileId(matchingProfile?.id ?? null);
      setProfileName(matchingProfile?.name ?? '');
      setModelOptions([]);
      setModelLoadError(null);
    },
    []
  );

  const applyProviderConfig = useCallback(
    async (providerType: AIProviderType) => {
      const config = await loadProviderConfig(providerType);
      await applyLoadedConfig(config);
    },
    [applyLoadedConfig]
  );

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      await applyLoadedConfig(await loadAIConfig());
    } catch (err) {
      logger.error('[AIConfig] Failed to load config:', err);
    } finally {
      setLoading(false);
    }
  }, [applyLoadedConfig]);

  useEffect(() => {
    if (open) void loadConfig();
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

  const handleProfileChange = useCallback(
    (profileId: string) => {
      if (profileId === 'new') {
        setSelectedProfileId(null);
        setProfileName('');
        setBaseUrl(DEFAULT_CONFIGS[provider].baseUrl);
        setModel(DEFAULT_CONFIGS[provider].model);
        setContextWindow(undefined);
        setApiKey('');
        return;
      }
      const profile = profiles.find((item) => item.id === profileId);
      if (!profile) return;
      setSelectedProfileId(profile.id);
      setProfileName(profile.name);
      setBaseUrl(profile.baseUrl);
      setModel(profile.model);
      setContextWindow(profile.contextWindow);
      setApiKey(profile.apiKey);
    },
    [profiles, provider]
  );

  const refreshModels = useCallback(async () => {
    if (provider !== 'opencode') return;
    setModelsLoading(true);
    setModelLoadError(null);
    try {
      const models = await createProvider(provider, baseUrl, model, apiKey).listModels();
      setModelOptions(models.map((item) => ({ ...item, availability: 'checking' as const })));
      setModelOptions(await checkOpenCodeModels(baseUrl, models, apiKey));
    } catch (err) {
      logger.error('[AIConfig] Failed to load OpenCode models:', err);
      setModelLoadError(
        err instanceof Error && err.message
          ? `获取模型列表失败：${err.message}`
          : '获取模型列表失败，请检查网络后重试。'
      );
    } finally {
      setModelsLoading(false);
    }
  }, [apiKey, baseUrl, model, provider]);

  const handleSave = useCallback(async () => {
    setLoading(true);
    try {
      if (provider === 'opencode') {
        await saveAIConfig({ provider, baseUrl, model, apiKey, contextWindow });
      } else if (selectedProfileId) {
        await updateAIProfile(selectedProfileId, {
          provider,
          name: profileName || '未命名配置',
          baseUrl,
          model,
          apiKey,
          contextWindow,
        });
        await activateAIProfile(selectedProfileId);
      } else {
        const id = await createAIProfile({
          provider,
          name: profileName || '未命名配置',
          baseUrl,
          model,
          apiKey,
          contextWindow,
        });
        setSelectedProfileId(id);
      }
      onSaved?.();
      return true;
    } catch (err) {
      logger.error('[AIConfig] Failed to save config:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [apiKey, baseUrl, contextWindow, model, onSaved, profileName, provider, selectedProfileId]);

  return {
    provider,
    baseUrl,
    model,
    apiKey,
    contextWindow,
    profileName,
    profiles,
    selectedProfileId,
    loading,
    setBaseUrl,
    setModel,
    setApiKey,
    setContextWindow,
    setProfileName,
    handleProviderChange,
    handleProfileChange,
    modelOptions,
    modelsLoading,
    modelLoadError,
    refreshModels,
    handleSave,
  };
}
