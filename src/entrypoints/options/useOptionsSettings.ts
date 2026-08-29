import { useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { useToast } from '@/components/ui/toast';
import { db } from '@/db';
import { updateSetting } from '@/lib/db/settings';
import { logger } from '@/utils/logger';
import { VALIDATION_LIMITS, validateLength } from '@/utils/validation';
import {
  DEFAULT_FEATURE_TOGGLES,
  FEATURE_KEY_MAP,
  FEATURE_LABEL_MAP,
  resolveFeatureToggles,
} from './optionsFeatureShared';
import { SETTINGS_CATEGORIES, getSettingValue } from './optionsShared';
import type { AutoSyncState, CustomConfigState, FeatureTogglesState } from './optionsTypes';

export function useOptionsSettings() {
  const { toast } = useToast();
  const [customConfig, setCustomConfig] = useState<CustomConfigState>({ serverUrl: '' });
  const [accessToken, setAccessToken] = useState('');
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [autoSync, setAutoSync] = useState<AutoSyncState>({ enabled: true, interval: 30 });
  const [featureToggles, setFeatureToggles] =
    useState<FeatureTogglesState>(DEFAULT_FEATURE_TOGGLES);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [featureToggleSaving, setFeatureToggleSaving] = useState(false);
  const settingsSaveInFlightRef = useRef(false);
  const featureToggleSaveInFlightRef = useRef(false);
  const dirtyRef = useRef(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    SETTINGS_CATEGORIES.map((category) => category.key)
  );

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const settings = await db.settings.toArray();
        if (!mounted) return;

        const lastSync = getSettingValue(settings, 'last_sync_time');
        if (lastSync) {
          setLastSyncTime(lastSync);
        }

        if (!dirtyRef.current) {
          setCustomConfig({
            serverUrl: getSettingValue(settings, 'custom_server_url') || '',
          });
          setAccessToken(getSettingValue(settings, 'sync_access_token') || '');
          setAutoSync({
            enabled: getSettingValue(settings, 'auto_sync_enabled') ?? true,
            interval: getSettingValue(settings, 'auto_sync_interval') ?? 30,
          });
          setFeatureToggles(resolveFeatureToggles(settings));
        }
      } catch (error) {
        logger.error('Failed to load options settings:', error);
        if (mounted) toast('读取设置失败', 'error');
      } finally {
        if (mounted) setSettingsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [toast]);

  const saveDataSourceConfig = async () => {
    if (settingsSaveInFlightRef.current) return;

    const urlValidation = validateLength(
      customConfig.serverUrl,
      VALIDATION_LIMITS.SYNC_SERVER_URL_MAX,
      '服务器地址'
    );
    if (!urlValidation.valid) {
      toast(urlValidation.error ?? '服务器地址长度超出限制', 'error');
      return;
    }

    const tokenValidation = validateLength(
      accessToken,
      VALIDATION_LIMITS.SYNC_ACCESS_TOKEN_MAX,
      '访问令牌'
    );
    if (!tokenValidation.valid) {
      toast(tokenValidation.error ?? '访问令牌长度超出限制', 'error');
      return;
    }

    try {
      settingsSaveInFlightRef.current = true;
      setSettingsSaving(true);
      await db.transaction('rw', db.settings, async () => {
        await updateSetting('custom_server_url', customConfig.serverUrl);
        await updateSetting('sync_access_token', accessToken);
        await updateSetting('auto_sync_enabled', autoSync.enabled);
        await updateSetting('auto_sync_interval', autoSync.interval);
      });
      await browser.runtime
        .sendMessage({ type: 'AUTO_SYNC_SETTINGS_CHANGED' })
        .catch((error) => logger.error('Failed to send settings change:', error));

      toast('配置已保存', 'success');
      dirtyRef.current = false;
    } catch (error) {
      logger.error(error);
      toast('保存失败', 'error');
    } finally {
      settingsSaveInFlightRef.current = false;
      setSettingsSaving(false);
    }
  };

  const toggleFeature = async (feature: keyof FeatureTogglesState, enabled: boolean) => {
    if (featureToggleSaveInFlightRef.current) return;
    try {
      featureToggleSaveInFlightRef.current = true;
      setFeatureToggleSaving(true);
      await updateSetting(FEATURE_KEY_MAP[feature], enabled);
      setFeatureToggles((previous) => ({ ...previous, [feature]: enabled }));
      toast(`${FEATURE_LABEL_MAP[feature]}功能已${enabled ? '启用' : '禁用'}`, 'success');
    } catch (error) {
      logger.error('Failed to toggle feature:', error);
      toast(`${FEATURE_LABEL_MAP[feature]}功能设置失败`, 'error');
    } finally {
      featureToggleSaveInFlightRef.current = false;
      setFeatureToggleSaving(false);
    }
  };

  const updateAccessToken = (value: string) => {
    dirtyRef.current = true;
    setAccessToken(value);
  };

  const updateAutoSync = (value: AutoSyncState) => {
    dirtyRef.current = true;
    setAutoSync(value);
  };

  const updateCustomConfig = (value: CustomConfigState) => {
    dirtyRef.current = true;
    setCustomConfig(value);
  };

  return {
    accessToken,
    autoSync,
    customConfig,
    featureToggles,
    featureToggleSaving,
    lastSyncTime,
    saveDataSourceConfig,
    settingsLoading,
    settingsSaving,
    selectedCategories,
    setAccessToken: updateAccessToken,
    setAutoSync: updateAutoSync,
    setCustomConfig: updateCustomConfig,
    setFeatureToggles,
    setSelectedCategories,
    setShowExportDialog,
    showExportDialog,
    toggleFeature,
  };
}
