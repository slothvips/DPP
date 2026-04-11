import { useEffect, useState } from 'react';
import { useToast } from '@/components/ui/toast';
import type { JenkinsEnvironment } from '@/db';
import { syncLegacyJenkinsSettings } from '@/lib/db/jenkins';
import { updateSetting } from '@/lib/db/settings';
import { useConfirmDialog } from '@/utils/confirm-dialog';
import { logger } from '@/utils/logger';
import { VALIDATION_LIMITS, validateLength } from '@/utils/validation';
import { autoDetectJenkinsEnv } from './jenkinsEnvAutoDetect';

interface UseJenkinsEnvDialogOptions {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData: JenkinsEnvironment | null;
  existingEnvs: JenkinsEnvironment[];
  currentEnvId: string;
}

const EMPTY_FORM: Partial<JenkinsEnvironment> = {
  name: '',
  host: '',
  user: '',
  token: '',
};

export function useJenkinsEnvDialog({
  open,
  onOpenChange,
  initialData,
  existingEnvs,
  currentEnvId,
}: UseJenkinsEnvDialogOptions) {
  const { toast } = useToast();
  const { confirm } = useConfirmDialog();
  const [formData, setFormData] = useState<Partial<JenkinsEnvironment>>(EMPTY_FORM);
  const [isDetecting, setIsDetecting] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (initialData) {
      setFormData(initialData);
      return;
    }

    setFormData(EMPTY_FORM);
  }, [initialData, open]);

  const updateField = <K extends keyof JenkinsEnvironment>(
    key: K,
    value: JenkinsEnvironment[K]
  ) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const validate = () => {
    if (!formData.name?.trim()) {
      return '名称不能为空';
    }
    if (!formData.host?.trim()) {
      return '服务器地址不能为空';
    }

    const isNameDuplicate = existingEnvs.some(
      (env) => env.name === formData.name && env.id !== initialData?.id
    );
    if (isNameDuplicate) {
      return '环境名称必须唯一';
    }

    const hostValidation = validateLength(
      formData.host,
      VALIDATION_LIMITS.JENKINS_HOST_MAX,
      'Host'
    );
    if (!hostValidation.valid) {
      return hostValidation.error;
    }

    return null;
  };

  const handleSave = async () => {
    const error = validate();
    if (error) {
      toast(error, 'error');
      return;
    }

    try {
      const newEnv: JenkinsEnvironment = {
        id: initialData?.id || crypto.randomUUID(),
        name: (formData.name || '').trim(),
        host: (formData.host || '').trim(),
        user: formData.user?.trim() || '',
        token: formData.token?.trim() || '',
        order: initialData?.order ?? existingEnvs.length,
      };

      const nextEnvs = initialData
        ? existingEnvs.map((env) => (env.id === initialData.id ? newEnv : env))
        : [...existingEnvs, newEnv];

      await updateSetting('jenkins_environments', nextEnvs);

      const shouldSyncLegacy = existingEnvs.length === 0 || initialData?.id === currentEnvId;
      if (existingEnvs.length === 0) {
        await updateSetting('jenkins_current_env', newEnv.id);
      }

      if (shouldSyncLegacy) {
        await syncLegacyJenkinsSettings({
          host: newEnv.host,
          user: newEnv.user,
          token: newEnv.token,
        });
      }

      toast(initialData ? '环境已更新' : '环境已添加', 'success');
      onOpenChange(false);
    } catch (error) {
      logger.error(error);
      toast('保存环境失败', 'error');
    }
  };

  const handleAutoDetect = async () => {
    setIsDetecting(true);
    try {
      const detected = await autoDetectJenkinsEnv(formData.host || '', (message) =>
        confirm(message)
      );
      if (!detected) {
        return;
      }

      setFormData((prev) => ({
        ...prev,
        host: detected.host,
        user: detected.user,
        token: detected.token,
        name: prev.name || detected.name,
      }));
      toast(`已连接为 ${detected.user}. 令牌已生成。`, 'success');
    } catch (error) {
      logger.error(error);
      toast(`自动检测失败: ${error instanceof Error ? error.message : String(error)}`, 'error');
    } finally {
      setIsDetecting(false);
    }
  };

  return {
    formData,
    isDetecting,
    updateField,
    handleSave,
    handleAutoDetect,
  };
}
