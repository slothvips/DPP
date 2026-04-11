import { useToast } from '@/components/ui/toast';
import { db, getSyncEngine } from '@/db';
import type { JenkinsEnvironment } from '@/db/types';
import { useConfirmDialog } from '@/utils/confirm-dialog';
import { logger } from '@/utils/logger';
import { EXCLUDED_SETTINGS, type ImportedSetting, isImportedSetting } from './optionsShared';

export function useOptionsImportAndReset() {
  const { toast } = useToast();
  const { confirm } = useConfirmDialog();

  const importSettings = async (importedSettings: ImportedSetting[]) => {
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

        const importedSettings: ImportedSetting[] = parsed.data.settings.filter(isImportedSetting);
        if (importedSettings.length === 0) {
          throw new Error('文件中没有可识别的设置项');
        }

        const hasKey = importedSettings.some((setting) => setting.key === 'sync_encryption_key');
        const confirmed = await confirm(
          `确定要导入配置数据吗？\n\n导出时间: ${new Date(parsed.exportDate).toLocaleString()}\n版本: ${parsed.version}\n${hasKey ? '包含同步密钥: 是\n' : '包含同步密钥: 否\n'}⚠️ 这将清空所有本地数据，导入后请重新同步！`,
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
    const confirmed = await confirm('确定要清空所有数据并重置吗？', '确认清空', 'danger');
    if (!confirmed) {
      return;
    }

    await db.delete();
    await db.open();
    toast('数据已清空', 'info');
    setTimeout(() => window.location.reload(), 1000);
  };

  const rebuildLocalData = async () => {
    const confirmed = await confirm(
      '此操作将清空本地同步数据并从服务器重新拉取，未同步到服务器的本地数据将会丢失。\n\n正常来讲，你永远不会用到这个功能。\n\n⚠️ 请仅在数据异常时使用（至少与两名团队成员数据不一致）。',
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

      await engine.clearAllData();
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
