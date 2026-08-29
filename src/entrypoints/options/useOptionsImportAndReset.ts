import { useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { db, getSyncEngine } from '@/db';
import type { AIProfile, JenkinsEnvironment, StoredEncryptedValue } from '@/db/types';
import { isAIProviderType } from '@/lib/ai/providerIds';
import { decryptData, encryptData, exportKey, importKey, loadKey } from '@/lib/crypto/encryption';
import { loadPersonalKey } from '@/lib/crypto/personalKey';
import { clearAllLocalData } from '@/lib/db/clearAllLocalData';
import { useConfirmDialog } from '@/utils/confirm-dialog';
import { logger } from '@/utils/logger';
import {
  EXCLUDED_SETTINGS,
  type ImportedSetting,
  SETTINGS_CATEGORIES,
  isLegacyAISettingKey,
  isStoredEncryptedValue,
  parseImportedSettings,
} from './optionsShared';

interface PendingImport {
  exportDate: string;
  importedProfiles: AIProfile[];
  importedSettings: ImportedSetting[];
  hasAIProfiles: boolean;
  version: string;
}

export type RebuildPhase = 'preparing' | 'clearing' | 'pulling' | 'complete' | null;

async function validateEncryptedAISettings(settings: ImportedSetting[]): Promise<void> {
  const encryptedSettings = settings.filter(
    (setting) =>
      (setting.key === 'ai_api_key' ||
        (setting.key.startsWith('ai_') && setting.key.endsWith('_api_key'))) &&
      isStoredEncryptedValue(setting.value)
  );
  if (encryptedSettings.length === 0) {
    return;
  }

  const syncKeySetting = settings.find((setting) => setting.key === 'sync_encryption_key');
  let syncKeyValue =
    typeof syncKeySetting?.value === 'string' && syncKeySetting.value
      ? syncKeySetting.value
      : undefined;
  if (!syncKeyValue) {
    const localKey = await loadKey();
    if (!localKey) {
      throw new Error('备份包含加密的 AI API Key，但缺少同步密钥，已取消导入');
    }
    syncKeyValue = await exportKey(localKey);
  }

  try {
    const key = await importKey(syncKeyValue);
    const decryptedValues = await Promise.all(
      encryptedSettings.map((setting) => decryptData(setting.value as StoredEncryptedValue, key))
    );
    if (decryptedValues.some((value) => typeof value !== 'string')) {
      throw new Error('AI API Key decrypted to an invalid value');
    }
  } catch {
    throw new Error('备份中的同步密钥无法解密 AI API Key，已取消导入');
  }
}

async function reencryptValue(
  value: StoredEncryptedValue,
  sourceKey: CryptoKey,
  targetKey: CryptoKey
): Promise<StoredEncryptedValue> {
  const decrypted = await decryptData(value, sourceKey);
  if (typeof decrypted !== 'string') {
    throw new Error('加密的 AI API Key 内容无效');
  }
  return await encryptData(decrypted, targetKey);
}

function parseImportedProfiles(value: unknown): AIProfile[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error('备份中的 AI profiles 格式无效');

  return value.map((item): AIProfile => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error('备份中的 AI profile 格式无效');
    }
    const profile = item as Record<string, unknown>;
    if (
      typeof profile.id !== 'string' ||
      typeof profile.name !== 'string' ||
      !isAIProviderType(profile.provider) ||
      profile.provider === 'opencode' ||
      typeof profile.baseUrl !== 'string' ||
      typeof profile.model !== 'string' ||
      (profile.contextWindow !== undefined && typeof profile.contextWindow !== 'number') ||
      (typeof profile.apiKey !== 'string' && !isStoredEncryptedValue(profile.apiKey)) ||
      typeof profile.createdAt !== 'number' ||
      typeof profile.updatedAt !== 'number'
    ) {
      throw new Error('备份中的 AI profile 字段无效');
    }
    return profile as unknown as AIProfile;
  });
}

export function useOptionsImportAndReset() {
  const { toast } = useToast();
  const { confirm } = useConfirmDialog();
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [selectedImportCategories, setSelectedImportCategories] = useState<string[]>([]);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const [rebuildPhase, setRebuildPhase] = useState<RebuildPhase>(null);

  const importSettings = async (
    importedSettings: ImportedSetting[],
    importedProfiles: AIProfile[],
    includeAISettings: boolean,
    hasAIProfiles: boolean
  ) => {
    await db.transaction('rw', [db.settings, db.aiProfiles], async () => {
      let settings = importedSettings.filter((setting) => !EXCLUDED_SETTINGS.includes(setting.key));

      const hasEnvironments = settings.some((setting) => setting.key === 'jenkins_environments');
      const host = settings.find((setting) => setting.key === 'jenkins_host');
      const user = settings.find((setting) => setting.key === 'jenkins_user');
      const token = settings.find((setting) => setting.key === 'jenkins_token');

      if (!hasEnvironments && (host || user || token)) {
        const defaultEnv: JenkinsEnvironment = {
          id: crypto.randomUUID(),
          name: 'Default',
          host: typeof host?.value === 'string' ? host.value : '',
          user: typeof user?.value === 'string' ? user.value : '',
          token: typeof token?.value === 'string' ? token.value : '',
          order: 0,
        };
        settings.push({ key: 'jenkins_environments', value: [defaultEnv] });

        if (!settings.some((setting) => setting.key === 'jenkins_current_env')) {
          settings.push({ key: 'jenkins_current_env', value: defaultEnv.id });
        }

        logger.info('Migrated legacy Jenkins settings during import');
      }

      settings = settings.filter(
        (setting) => !['jenkins_host', 'jenkins_user', 'jenkins_token'].includes(setting.key)
      );

      if (hasAIProfiles) {
        await db.aiProfiles.clear();
      }

      if (hasAIProfiles && importedProfiles.length > 0) {
        await db.aiProfiles.bulkAdd(importedProfiles);
      } else if (includeAISettings) {
        settings = settings.filter((setting) => setting.key !== 'ai_active_profile_id');
      }

      await db.settings.bulkPut(settings as Parameters<typeof db.settings.bulkPut>[0]);
    });
  };

  const handleImport = async () => {
    if (!pendingImport || selectedImportCategories.length === 0) {
      toast('请至少选择一种导入内容', 'error');
      return;
    }

    try {
      const allowedKeys = new Set(
        SETTINGS_CATEGORIES.filter((category) =>
          selectedImportCategories.includes(category.key)
        ).flatMap((category) => category.keys)
      );
      if (selectedImportCategories.includes('jenkins_envs')) {
        allowedKeys.add('jenkins_host');
        allowedKeys.add('jenkins_user');
        allowedKeys.add('jenkins_token');
      }
      if (selectedImportCategories.includes('ai_settings')) {
        allowedKeys.add('ai_base_url');
        allowedKeys.add('ai_model');
        allowedKeys.add('ai_api_key');
        pendingImport.importedSettings.forEach((setting) => {
          if (isLegacyAISettingKey(setting.key)) allowedKeys.add(setting.key);
        });
      }
      const replaceAll = selectedImportCategories.length === SETTINGS_CATEGORIES.length;
      let importedSettings = pendingImport.importedSettings.filter((setting) =>
        allowedKeys.has(setting.key)
      );
      const includeAIProfiles = selectedImportCategories.includes('ai_settings');
      let importedProfiles = includeAIProfiles ? pendingImport.importedProfiles : [];
      const profileKeySettings: ImportedSetting[] = importedProfiles
        .filter((profile) => isStoredEncryptedValue(profile.apiKey))
        .map((profile) => ({ key: 'ai_api_key', value: profile.apiKey }));
      const hasEncryptedAIKey = [...importedSettings, ...profileKeySettings].some(
        (setting) =>
          (setting.key === 'ai_api_key' ||
            (setting.key.startsWith('ai_') && setting.key.endsWith('_api_key'))) &&
          isStoredEncryptedValue(setting.value)
      );
      const syncKey = pendingImport.importedSettings.find(
        (setting) => setting.key === 'sync_encryption_key'
      );
      if (hasEncryptedAIKey && syncKey && replaceAll) {
        importedSettings.push(syncKey);
      }
      await validateEncryptedAISettings([...importedSettings, ...profileKeySettings]);

      if (hasEncryptedAIKey && !replaceAll) {
        const localKey = await loadKey();
        if (!localKey) {
          throw new Error('本地未配置同步密钥，无法安全导入加密的 AI API Key');
        }
        const sourceKey = syncKey ? await importKey(syncKey.value as string) : localKey;
        importedSettings = await Promise.all(
          importedSettings.map(async (setting) => {
            if (
              !isStoredEncryptedValue(setting.value) ||
              !(
                setting.key === 'ai_api_key' ||
                (setting.key.startsWith('ai_') && setting.key.endsWith('_api_key'))
              )
            ) {
              return setting;
            }
            return { ...setting, value: await reencryptValue(setting.value, sourceKey, localKey) };
          })
        );
        importedProfiles = await Promise.all(
          importedProfiles.map(async (profile) =>
            isStoredEncryptedValue(profile.apiKey)
              ? {
                  ...profile,
                  apiKey: await reencryptValue(profile.apiKey, sourceKey, localKey),
                }
              : profile
          )
        );
        importedSettings = importedSettings.filter(
          (setting) => setting.key !== 'sync_encryption_key'
        );
      }

      if (importedSettings.length === 0 && importedProfiles.length === 0) {
        throw new Error('所选内容在文件中没有可导入的数据');
      }

      const hasKey = importedSettings.some((setting) => setting.key === 'sync_encryption_key');
      let hasLocalPersonalKey = false;
      try {
        hasLocalPersonalKey = Boolean(await loadPersonalKey());
      } catch (error) {
        logger.warn('[Import] Failed to check personal key before import:', error);
      }
      const personalKeyClause = hasLocalPersonalKey ? '已配置的个人私钥将保留。\n' : '';
      const confirmed = await confirm(
        `确定要导入选中的配置数据吗？\n\n导出时间: ${new Date(pendingImport.exportDate).toLocaleString()}\n版本: ${pendingImport.version}\n导入类型: ${selectedImportCategories.length === SETTINGS_CATEGORIES.length ? '全部' : '仅选中项'}\n${hasKey ? '包含同步密钥: 是\n' : '包含同步密钥: 否\n'}${personalKeyClause}未勾选的设置和本地业务数据将保留。`,
        '确认导入'
      );

      if (!confirmed) {
        return;
      }

      await importSettings(
        importedSettings,
        importedProfiles,
        includeAIProfiles,
        includeAIProfiles && pendingImport.hasAIProfiles
      );
      setShowImportDialog(false);
      setPendingImport(null);
      toast('配置导入成功！即将刷新页面...', 'success');
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      logger.error('Import error:', error);
      toast(`导入失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  };

  const handleSelectFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';

    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) {
        return;
      }

      try {
        const text = await file.text();
        const parsed = JSON.parse(text);

        if (!parsed.version || !parsed.data) {
          throw new Error('无效的备份文件格式');
        }

        if (!Array.isArray(parsed.data.settings)) {
          throw new Error('备份中的应用设置数据格式无效');
        }

        const importedSettings = parseImportedSettings(parsed.data.settings as unknown[]);
        const importedProfiles = parseImportedProfiles(parsed.data.aiProfiles);
        if (importedSettings.length === 0 && importedProfiles.length === 0) {
          throw new Error('文件中没有可识别的设置项或 AI profile');
        }
        setPendingImport({
          exportDate: typeof parsed.exportDate === 'string' ? parsed.exportDate : '',
          importedProfiles,
          importedSettings,
          hasAIProfiles: Object.prototype.hasOwnProperty.call(parsed.data, 'aiProfiles'),
          version: String(parsed.version),
        });
        setSelectedImportCategories(SETTINGS_CATEGORIES.map((category) => category.key));
        setShowImportDialog(true);
      } catch (error) {
        logger.error('Import error:', error);
        toast(`导入失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
      }
    };

    input.click();
  };

  const clearData = async () => {
    const confirmed = await confirm(
      '确定要清空所有数据并重置吗？\n\n将清除 IndexedDB、localStorage、sessionStorage、扩展 storage 与缓存中的全部本地数据（含验证器、个人私钥、团队同步数据等）。此操作不可恢复。',
      '确认清空',
      'danger'
    );
    if (!confirmed) {
      return;
    }

    try {
      await clearAllLocalData();
      await db.open();
      toast('数据已清空', 'info');
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      logger.error('Failed to clear all local data:', error);
      toast(`清空失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  };

  const rebuildLocalData = async () => {
    let hasPersonalKey = false;
    try {
      hasPersonalKey = Boolean(await loadPersonalKey());
    } catch (error) {
      logger.warn('[DataRebuild] Failed to check personal key:', error);
    }

    const personalClause = hasPersonalKey
      ? '已配置个人私钥：验证器等个人同步数据也会被清空，再从服务器拉取（未成功同步的内容会丢失）。'
      : '未配置个人私钥：验证器等仅本地个人数据将保留（无法从服务器恢复，故不清除）。';

    const confirmed = await confirm(
      `此操作将清空本地团队同步数据并从服务器重新拉取。个人私钥不会被清除。\n\n${personalClause}\n\n未同步到服务器的本地团队数据将会丢失。\n\n正常来讲，你永远不会用到这个功能。\n\n⚠️ 请仅在数据异常时使用。`,
      '确认重建本地数据',
      'danger'
    );

    if (!confirmed) {
      return;
    }

    setRebuildPhase('preparing');
    try {
      const engine = await getSyncEngine();
      if (!engine) {
        throw new Error('同步引擎初始化失败');
      }

      // 有个人私钥：个人数据可走同步恢复 → 一并清空；无私钥：仅本地 → 保留
      setRebuildPhase('clearing');
      await engine.clearAllData({ preservePersonal: !hasPersonalKey });
      setRebuildPhase('pulling');
      await engine.pull();

      setRebuildPhase('complete');
      toast('数据重建成功', 'success');
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      setRebuildPhase(null);
      logger.error('[DataRebuild] Failed:', error);
      toast(`数据重建失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  };

  return {
    clearData,
    handleImport,
    handleSelectFile,
    rebuildPhase,
    rebuildLocalData,
    selectedImportCategories,
    setSelectedImportCategories,
    setShowImportDialog,
    showImportDialog,
  };
}
