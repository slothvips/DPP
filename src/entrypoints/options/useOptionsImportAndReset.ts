import { useToast } from '@/components/ui/toast';
import { db, getSyncEngine } from '@/db';
import type { JenkinsEnvironment, Setting, StoredEncryptedValue } from '@/db/types';
import { decryptData, exportKey, importKey, loadKey } from '@/lib/crypto/encryption';
import { loadPersonalKey } from '@/lib/crypto/personalKey';
import { clearAllLocalData } from '@/lib/db/clearAllLocalData';
import { useConfirmDialog } from '@/utils/confirm-dialog';
import { logger } from '@/utils/logger';
import {
  EXCLUDED_SETTINGS,
  IMPORT_PRESERVED_SETTINGS,
  type ImportedSetting,
  isStoredEncryptedValue,
  parseImportedSettings,
} from './optionsShared';

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

  let syncKeySetting = settings.find((setting) => setting.key === 'sync_encryption_key');
  let syncKeyValue =
    typeof syncKeySetting?.value === 'string' && syncKeySetting.value
      ? syncKeySetting.value
      : undefined;
  if (!syncKeyValue) {
    const localKey = await loadKey();
    if (!localKey) {
      throw new Error('备份包含加密的 AI API Key，但缺少同步密钥，已取消导入');
    }
    const exportedLocalKey = await exportKey(localKey);
    syncKeySetting = {
      key: 'sync_encryption_key',
      value: exportedLocalKey,
    };
    syncKeyValue = exportedLocalKey;
    settings.push(syncKeySetting);
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

export function useOptionsImportAndReset() {
  const { toast } = useToast();
  const { confirm } = useConfirmDialog();

  const importSettings = async (importedSettings: ImportedSetting[]) => {
    // 导入会删库重建；个人私钥及相关 bootstrap 标记必须从本机保留
    const preservedSettings = (
      await Promise.all(IMPORT_PRESERVED_SETTINGS.map((key) => db.settings.get(key)))
    ).filter((row): row is Setting => row != null);

    await db.delete();
    await db.open();

    await db.transaction('rw', db.settings, async () => {
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

      await db.settings.bulkAdd(settings as Parameters<typeof db.settings.bulkAdd>[0]);

      if (preservedSettings.length > 0) {
        await db.settings.bulkPut(preservedSettings);
        logger.info(
          `Preserved ${preservedSettings.length} personal setting(s) across config import`
        );
      }
    });
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

        if (!Array.isArray(parsed.data.settings) || parsed.data.settings.length === 0) {
          throw new Error('文件中没有应用设置数据');
        }

        const importedSettings = parseImportedSettings(parsed.data.settings as unknown[]);
        if (importedSettings.length === 0) {
          throw new Error('文件中没有可识别的设置项');
        }
        await validateEncryptedAISettings(importedSettings);

        const hasKey = importedSettings.some((setting) => setting.key === 'sync_encryption_key');
        let hasLocalPersonalKey = false;
        try {
          hasLocalPersonalKey = Boolean(await loadPersonalKey());
        } catch (error) {
          logger.warn('[Import] Failed to check personal key before import:', error);
        }
        const personalKeyClause = hasLocalPersonalKey
          ? '已配置的个人私钥将保留（不会被清空或覆盖）。\n'
          : '';
        const confirmed = await confirm(
          `确定要导入配置数据吗？\n\n导出时间: ${new Date(parsed.exportDate).toLocaleString()}\n版本: ${parsed.version}\n${hasKey ? '包含同步密钥: 是\n' : '包含同步密钥: 否\n'}${personalKeyClause}⚠️ 这将清空本地业务数据并覆盖应用设置，导入后请重新同步！`,
          '确认导入'
        );

        if (!confirmed) {
          return;
        }

        await importSettings(importedSettings);
        toast('配置导入成功！即将刷新页面...', 'success');
        setTimeout(() => window.location.reload(), 1500);
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

    try {
      toast('正在重建数据...', 'info');

      const engine = await getSyncEngine();
      if (!engine) {
        throw new Error('同步引擎初始化失败');
      }

      // 有个人私钥：个人数据可走同步恢复 → 一并清空；无私钥：仅本地 → 保留
      await engine.clearAllData({ preservePersonal: !hasPersonalKey });
      await engine.pull();

      toast('数据重建成功', 'success');
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      logger.error('[DataRebuild] Failed:', error);
      toast('数据重建失败: ' + (error as Error).message, 'error');
    }
  };

  return {
    clearData,
    handleSelectFile,
    rebuildLocalData,
  };
}
