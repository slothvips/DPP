import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { checkOpenCodeModels } from '@/lib/ai/openCodeProviderModels';
import { DEFAULT_CONFIGS, createProvider } from '@/lib/ai/provider';
import { DEFAULT_AI_PROVIDER } from '@/lib/ai/providerIds';
import type { AIProviderType, Model } from '@/lib/ai/types';
import { useConfirmDialog } from '@/utils/confirm-dialog';
import { logger } from '@/utils/logger';
import { toConfigProvider } from '../components/aiConfigDialogShared';
import {
  type AIProfileSummary,
  activateAIProfile,
  createAIProfile,
  deleteAIProfile,
  duplicateAIProfile,
  loadAIConfig,
  loadAIProfiles,
  loadProviderConfig,
  saveAIConfig,
  updateAIProfile,
} from '../lib/aiConfigStorage';

export function useAIConfigDialog(open: boolean, onSaved?: () => void) {
  const { confirm } = useConfirmDialog();
  const { toast } = useToast();
  const [provider, setProvider] = useState<AIProviderType>(DEFAULT_AI_PROVIDER);
  const [baseUrl, setBaseUrl] = useState(DEFAULT_CONFIGS[DEFAULT_AI_PROVIDER].baseUrl);
  const [model, setModel] = useState(DEFAULT_CONFIGS[DEFAULT_AI_PROVIDER].model);
  const [contextWindow, setContextWindow] = useState<number | undefined>();
  const [visionEnabled, setVisionEnabled] = useState(false);
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
      setVisionEnabled(config.visionEnabled === true);
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
        setVisionEnabled(false);
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
      setVisionEnabled(profile.visionEnabled === true);
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

  const handleDuplicateProfile = useCallback(async () => {
    if (!selectedProfileId) return;
    try {
      const newId = await duplicateAIProfile(selectedProfileId);
      const nextProfiles = await loadAIProfiles();
      setProfiles(nextProfiles);
      const copy = nextProfiles.find((item) => item.id === newId);
      if (copy) {
        setSelectedProfileId(copy.id);
        setProfileName(copy.name);
      }
      toast('已复制配置档案', 'success');
    } catch (err) {
      logger.error('[AIConfig] Failed to duplicate profile:', err);
      toast('复制失败，请稍后重试', 'error');
    }
  }, [selectedProfileId, toast]);

  const handleDeleteProfile = useCallback(async () => {
    if (!selectedProfileId) return;
    const profile = profiles.find((item) => item.id === selectedProfileId);
    const confirmed = await confirm(
      `确定要删除「${profile?.name ?? '该配置档案'}」吗？`,
      '删除配置档案',
      'danger'
    );
    if (!confirmed) return;
    try {
      await deleteAIProfile(selectedProfileId);
      setSelectedProfileId(null);
      setProfileName('');
      setProfiles(await loadAIProfiles());
      toast('已删除配置档案', 'success');
    } catch (err) {
      logger.error('[AIConfig] Failed to delete profile:', err);
      toast('删除失败，请稍后重试', 'error');
    }
  }, [confirm, profiles, selectedProfileId, toast]);

  const handleSave = useCallback(async () => {
    setLoading(true);
    try {
      if (provider === 'opencode') {
        await saveAIConfig({ provider, baseUrl, model, apiKey, contextWindow, visionEnabled });
      } else if (selectedProfileId) {
        await updateAIProfile(selectedProfileId, {
          provider,
          name: profileName || '未命名配置',
          baseUrl,
          model,
          apiKey,
          contextWindow,
          visionEnabled,
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
          visionEnabled,
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
  }, [
    apiKey,
    baseUrl,
    contextWindow,
    model,
    onSaved,
    profileName,
    provider,
    selectedProfileId,
    visionEnabled,
  ]);

  return {
    provider,
    baseUrl,
    model,
    apiKey,
    contextWindow,
    visionEnabled,
    profileName,
    profiles,
    selectedProfileId,
    loading,
    setBaseUrl,
    setModel,
    setApiKey,
    setContextWindow,
    setVisionEnabled,
    setProfileName,
    handleProviderChange,
    handleProfileChange,
    handleDuplicateProfile,
    handleDeleteProfile,
    modelOptions,
    modelsLoading,
    modelLoadError,
    refreshModels,
    handleSave,
  };
}
