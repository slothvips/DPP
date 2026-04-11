import type { Dispatch, SetStateAction } from 'react';
import { useToast } from '@/components/ui/toast';
import { db } from '@/db';
import type { SettingKey } from '@/db/types';
import { useConfirmDialog } from '@/utils/confirm-dialog';
import { logger } from '@/utils/logger';
import { EXCLUDED_SETTINGS, SETTINGS_CATEGORIES } from './optionsShared';

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
      const hasEncryptionKey = filteredSettings.some(
        (setting) => setting.key === 'sync_encryption_key'
      );

      if (hasEncryptionKey) {
        const confirmed = await confirm(
          '安全提示：\n\n导出文件中将包含您的【同步加密密钥】。\n\n请务必妥善保管导出文件，不要分享给不可信的人，否则可能导致您的加密数据泄露。\n\n是否继续？',
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
