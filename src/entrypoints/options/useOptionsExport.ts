import type { Dispatch, SetStateAction } from 'react';
import { useToast } from '@/components/ui/toast';
import { db } from '@/db';
import type { SettingKey } from '@/db/types';
import { AI_PROVIDER_DEFINITIONS } from '@/lib/ai/providerRegistry';
import { useConfirmDialog } from '@/utils/confirm-dialog';
import { logger } from '@/utils/logger';
import { EXCLUDED_SETTINGS, SETTINGS_CATEGORIES, isStoredEncryptedValue } from './optionsShared';

const SENSITIVE_EXPORT_SETTING_KEYS = new Set<SettingKey>([
  'sync_encryption_key',
  'sync_access_token',
  'jenkins_token',
  'ai_api_key',
  ...AI_PROVIDER_DEFINITIONS.map((provider) => `ai_${provider.id}_api_key` as SettingKey),
]);

interface UseOptionsExportOptions {
  selectedCategories: string[];
  setShowExportDialog: Dispatch<SetStateAction<boolean>>;
}

export function useOptionsExport({
  selectedCategories,
  setShowExportDialog,
}: UseOptionsExportOptions) {
  const { toast } = useToast();
  const { confirm } = useConfirmDialog();

  const handleExport = async () => {
    if (selectedCategories.length === 0) {
      toast('请至少选择一种设置类型', 'error');
      return;
    }

    try {
      const allSettings = await db.settings.toArray();
      const safeSettings = allSettings.filter(
        (setting) => !EXCLUDED_SETTINGS.includes(setting.key as SettingKey)
      );

      const allowedKeys = new Set(
        SETTINGS_CATEGORIES.filter((category) => selectedCategories.includes(category.key)).flatMap(
          (category) => category.keys
        )
      );
      const filteredSettings = safeSettings.filter((setting) => allowedKeys.has(setting.key));
      const includeAIProfiles = selectedCategories.includes('ai_settings');
      const aiProfiles = includeAIProfiles ? await db.aiProfiles.toArray() : [];
      const hasEncryptedAIKey = filteredSettings.some(
        (setting) =>
          SENSITIVE_EXPORT_SETTING_KEYS.has(setting.key as SettingKey) &&
          setting.key !== 'sync_encryption_key' &&
          isStoredEncryptedValue(setting.value)
      );
      if (
        hasEncryptedAIKey &&
        !filteredSettings.some((setting) => setting.key === 'sync_encryption_key')
      ) {
        const syncKey = safeSettings.find((setting) => setting.key === 'sync_encryption_key');
        if (!syncKey || typeof syncKey.value !== 'string' || !syncKey.value) {
          throw new Error('AI API Key 已加密，但未找到对应的同步密钥，无法创建可恢复的备份');
        }
        filteredSettings.push(syncKey);
      }
      const sensitiveKeys = filteredSettings
        .map((setting) => setting.key as SettingKey)
        .filter((key) => SENSITIVE_EXPORT_SETTING_KEYS.has(key));
      if (aiProfiles.length > 0) sensitiveKeys.push('ai_api_key');

      if (sensitiveKeys.length > 0) {
        const confirmed = await confirm(
          `安全提示：\n\n导出文件中将包含敏感配置：${sensitiveKeys.join('、')}。\n\n请务必妥善保管导出文件，不要分享给不可信的人，否则可能导致凭据或加密数据泄露。\n\n是否继续？`,
          '确认导出'
        );
        if (!confirmed) {
          setShowExportDialog(false);
          return;
        }
      }

      const exportPayload = {
        version: '1.3',
        exportDate: new Date().toISOString(),
        data: {
          settings: filteredSettings,
          ...(includeAIProfiles ? { aiProfiles } : {}),
        },
      };

      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const categoryLabels = SETTINGS_CATEGORIES.filter((category) =>
        selectedCategories.includes(category.key)
      )
        .map((category) => category.label.replace(/\s+/g, ''))
        .join('+');

      anchor.href = url;
      anchor.download = `dpp-config-${categoryLabels}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);

      setShowExportDialog(false);
      toast('配置导出成功！', 'success');
    } catch (error) {
      logger.error('Export error:', error);
      toast('导出失败，请查看控制台', 'error');
    }
  };

  return { handleExport };
}
