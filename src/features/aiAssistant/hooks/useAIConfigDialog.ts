import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { checkOpenCodeModels } from '@/lib/ai/openCodeProviderModels';
import { DEFAULT_CONFIGS, createProvider } from '@/lib/ai/provider';
import { DEFAULT_AI_PROVIDER } from '@/lib/ai/providerIds';
import type { AIProviderType, Model } from '@/lib/ai/types';
import { useConfirmDialog } from '@/utils/confirm-dialog';
import { logger } from '@/utils/logger';
import { toConfigProvider } from '../components/aiConfigDialogShared';
import { type AIConfigValidationErrors, validateAIConfig } from '../lib/aiConfigDialogValidation';
import {
  type AIProfileSummary,
  type StoredAIConfig,
  activateAIProfile,
  createAIProfile,
  deleteAIProfile,
  duplicateAIProfile,
  loadAIConfig,
  loadAIProfiles,
  loadProviderConfig,
  saveProviderConfig,
  updateAIProfile,
} from '../lib/aiConfigStorage';

interface FormSnapshot {
  provider: AIProviderType;
  baseUrl: string;
  model: string;
  apiKey: string;
  contextWindow?: number;
  visionEnabled: boolean;
  profileName: string;
}

const NEW_PROVIDER: AIProviderType = 'anthropic';

export function useAIConfigDialog(open: boolean, onSaved?: () => void) {
  const { confirm } = useConfirmDialog();
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const defaultConfig = DEFAULT_CONFIGS[DEFAULT_AI_PROVIDER];
  const [view, setView] = useState<'list' | 'form'>('list');
  const [activeProvider, setActiveProvider] = useState<AIProviderType>(DEFAULT_AI_PROVIDER);
  const [provider, setProvider] = useState<AIProviderType>(DEFAULT_AI_PROVIDER);
  const [baseUrl, setBaseUrl] = useState(defaultConfig.baseUrl);
  const [model, setModel] = useState(defaultConfig.model);
  const [contextWindow, setContextWindow] = useState<number | undefined>();
  const [visionEnabled, setVisionEnabled] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [profileName, setProfileName] = useState('');
  const [profiles, setProfiles] = useState<AIProfileSummary[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [openCodeConfig, setOpenCodeConfig] = useState<StoredAIConfig>({
    provider: DEFAULT_AI_PROVIDER,
    baseUrl: defaultConfig.baseUrl,
    model: defaultConfig.model,
    apiKey: '',
  });
  const [initialForm, setInitialForm] = useState<FormSnapshot>({
    provider: DEFAULT_AI_PROVIDER,
    baseUrl: defaultConfig.baseUrl,
    model: defaultConfig.model,
    apiKey: '',
    visionEnabled: false,
    profileName: '',
  });
  const [errors, setErrors] = useState<AIConfigValidationErrors>({});
  const [loading, setLoading] = useState(false);
  const [modelOptions, setModelOptions] = useState<Model[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelLoadError, setModelLoadError] = useState<string | null>(null);

  const isDirty =
    view === 'form' &&
    (provider !== initialForm.provider ||
      baseUrl !== initialForm.baseUrl ||
      model !== initialForm.model ||
      apiKey !== initialForm.apiKey ||
      contextWindow !== initialForm.contextWindow ||
      visionEnabled !== initialForm.visionEnabled ||
      profileName !== initialForm.profileName);

  const applyForm = useCallback(
    (config: StoredAIConfig, name: string, profileId: string | null) => {
      const next: FormSnapshot = {
        provider: toConfigProvider(config.provider),
        baseUrl: config.baseUrl,
        model: config.model,
        apiKey: config.apiKey,
        contextWindow: config.contextWindow,
        visionEnabled: config.visionEnabled === true,
        profileName: name,
      };
      setProvider(next.provider);
      setBaseUrl(next.baseUrl);
      setModel(next.model);
      setApiKey(next.apiKey);
      setContextWindow(next.contextWindow);
      setVisionEnabled(next.visionEnabled);
      setProfileName(next.profileName);
      setSelectedProfileId(profileId);
      setInitialForm(next);
      setErrors({});
      setModelOptions([]);
      setModelLoadError(null);
    },
    []
  );

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const current = await loadAIConfig();
      const [nextProfiles, nextOpenCodeConfig] = await Promise.all([
        loadAIProfiles(),
        loadProviderConfig('opencode'),
      ]);
      setActiveProvider(toConfigProvider(current.provider));
      setProfiles(
        nextProfiles.sort((left, right) => Number(right.isActive) - Number(left.isActive))
      );
      setOpenCodeConfig(nextOpenCodeConfig);
    } catch (err) {
      logger.error('[AIConfig] Failed to load config:', err);
      toastRef.current('读取 AI 配置失败，请稍后重试', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setView('list');
    void loadOverview();
  }, [loadOverview, open]);

  const handleAdd = useCallback(() => {
    const config = DEFAULT_CONFIGS[NEW_PROVIDER];
    applyForm(
      { provider: NEW_PROVIDER, baseUrl: config.baseUrl, model: config.model, apiKey: '' },
      '',
      null
    );
    setView('form');
  }, [applyForm]);

  const handleEditOpenCode = useCallback(() => {
    applyForm(openCodeConfig, 'OpenCode Free', null);
    setView('form');
  }, [applyForm, openCodeConfig]);

  const handleEditProfile = useCallback(
    (profileId: string) => {
      const profile = profiles.find((item) => item.id === profileId);
      if (!profile) return;
      applyForm(profile, profile.name, profile.id);
      setView('form');
    },
    [applyForm, profiles]
  );

  const handleProviderChange = useCallback(
    async (newProvider: AIProviderType) => {
      if (selectedProfileId || newProvider === 'opencode' || newProvider === provider) return;
      if (isDirty && !(await confirm('当前修改尚未保存，确定要放弃吗？', '放弃修改', 'danger'))) {
        return;
      }
      const config = DEFAULT_CONFIGS[newProvider];
      applyForm(
        { provider: newProvider, baseUrl: config.baseUrl, model: config.model, apiKey: '' },
        '',
        null
      );
    },
    [applyForm, confirm, isDirty, provider, selectedProfileId]
  );

  const confirmDiscard = useCallback(async () => {
    if (!isDirty) return true;
    return confirm('当前修改尚未保存，确定要放弃吗？', '放弃修改', 'danger');
  }, [confirm, isDirty]);

  const handleBack = useCallback(async () => {
    if (!(await confirmDiscard())) return;
    setView('list');
  }, [confirmDiscard]);

  const clearError = useCallback((field: keyof AIConfigValidationErrors) => {
    setErrors((current) => ({ ...current, [field]: undefined }));
  }, []);

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

  const handleActivate = useCallback(
    async (target: 'opencode' | string) => {
      setLoading(true);
      try {
        if (target === 'opencode') {
          await saveProviderConfig(openCodeConfig, { activateProvider: true });
        } else {
          await activateAIProfile(target);
        }
        await loadOverview();
        onSaved?.();
        toast('已切换当前 AI 服务', 'success');
      } catch (err) {
        logger.error('[AIConfig] Failed to activate config:', err);
        toast('切换失败，请稍后重试', 'error');
      } finally {
        setLoading(false);
      }
    },
    [loadOverview, onSaved, openCodeConfig, toast]
  );

  const handleDuplicateProfile = useCallback(async () => {
    if (!selectedProfileId) return;
    setLoading(true);
    try {
      const newId = await duplicateAIProfile(selectedProfileId);
      const nextProfiles = await loadAIProfiles();
      const copy = nextProfiles.find((item) => item.id === newId);
      setProfiles(nextProfiles);
      if (copy) applyForm(copy, copy.name, copy.id);
      toast('已另存为副本', 'success');
    } catch (err) {
      logger.error('[AIConfig] Failed to duplicate profile:', err);
      toast('复制失败，请稍后重试', 'error');
    } finally {
      setLoading(false);
    }
  }, [applyForm, selectedProfileId, toast]);

  const handleDeleteProfile = useCallback(async () => {
    if (!selectedProfileId) return;
    const profile = profiles.find((item) => item.id === selectedProfileId);
    if (activeProvider !== 'opencode' && profile?.isActive) {
      toast('请先切换到其他 AI 服务，再删除当前配置', 'error');
      return;
    }
    const confirmed = await confirm(
      `确定要删除「${profile?.name ?? '该配置'}」吗？`,
      '删除 AI 配置',
      'danger'
    );
    if (!confirmed) return;
    setLoading(true);
    try {
      await deleteAIProfile(selectedProfileId);
      setView('list');
      await loadOverview();
      toast('已删除 AI 配置', 'success');
    } catch (err) {
      logger.error('[AIConfig] Failed to delete profile:', err);
      toast('删除失败，请稍后重试', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeProvider, confirm, loadOverview, profiles, selectedProfileId, toast]);

  const handleSave = useCallback(async () => {
    const validationErrors = validateAIConfig({
      provider,
      baseUrl,
      model,
      apiKey,
      profileName,
    });
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return false;
    }

    setLoading(true);
    const config = {
      provider,
      baseUrl: baseUrl.trim(),
      model: model.trim(),
      apiKey: apiKey.trim(),
      contextWindow,
      visionEnabled,
    };
    const affectsCurrent =
      (provider === 'opencode' && activeProvider === 'opencode') ||
      (activeProvider !== 'opencode' &&
        profiles.some((item) => item.id === selectedProfileId && item.isActive));
    try {
      if (provider === 'opencode') {
        await saveProviderConfig(config);
      } else if (selectedProfileId) {
        await updateAIProfile(selectedProfileId, {
          ...config,
          provider,
          name: profileName.trim(),
        });
      } else {
        await createAIProfile(
          { ...config, provider, name: profileName.trim() },
          { activate: false }
        );
      }
      setView('list');
      await loadOverview();
      if (affectsCurrent) onSaved?.();
      toast('AI 配置已保存', 'success');
      return true;
    } catch (err) {
      logger.error('[AIConfig] Failed to save config:', err);
      toast('保存失败，请稍后重试', 'error');
      return false;
    } finally {
      setLoading(false);
    }
  }, [
    activeProvider,
    apiKey,
    baseUrl,
    contextWindow,
    loadOverview,
    model,
    onSaved,
    profileName,
    profiles,
    provider,
    selectedProfileId,
    toast,
    visionEnabled,
  ]);

  return {
    view,
    activeProvider,
    openCodeConfig,
    provider,
    baseUrl,
    model,
    apiKey,
    contextWindow,
    profileName,
    profiles,
    selectedProfileId,
    errors,
    loading,
    isDirty,
    setBaseUrl,
    setModel,
    setApiKey,
    setContextWindow,
    setProfileName,
    clearError,
    handleAdd,
    handleEditOpenCode,
    handleEditProfile,
    handleProviderChange,
    handleBack,
    confirmDiscard,
    handleActivate,
    handleDuplicateProfile,
    handleDeleteProfile,
    modelOptions,
    modelsLoading,
    modelLoadError,
    refreshModels,
    handleSave,
  };
}
