import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useToast } from '@/components/ui/toast';
import type { JenkinsEnvironment } from '@/db';
import {
  clearLegacyJenkinsSettings,
  deleteJenkinsEnv,
  syncLegacyJenkinsSettings,
} from '@/lib/db/jenkins';
import { getSetting, updateSetting } from '@/lib/db/settings';
import { useConfirmDialog } from '@/utils/confirm-dialog';
import { logger } from '@/utils/logger';

export function useJenkinsEnvManager() {
  const { toast } = useToast();
  const { confirm } = useConfirmDialog();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEnv, setEditingEnv] = useState<JenkinsEnvironment | null>(null);

  const environments = useLiveQuery(async () => {
    return (await getSetting('jenkins_environments')) || [];
  }, []);

  const currentEnvId =
    useLiveQuery(async () => {
      return (await getSetting('jenkins_current_env')) || '';
    }) || '';

  const handleDelete = async (id: string) => {
    const confirmed = await confirm('确定要删除此环境吗？', '确认删除', 'danger');
    if (!confirmed) {
      return;
    }

    try {
      const nextEnvs = environments?.filter((env) => env.id !== id) || [];
      await updateSetting('jenkins_environments', nextEnvs);
      await deleteJenkinsEnv(id);

      if (currentEnvId === id) {
        const nextEnv = nextEnvs[0];
        await updateSetting('jenkins_current_env', nextEnv ? nextEnv.id : '');
        if (nextEnv) {
          await syncLegacyJenkinsSettings({
            host: nextEnv.host,
            user: nextEnv.user,
            token: nextEnv.token,
          });
        } else {
          await clearLegacyJenkinsSettings();
        }
      }

      toast('环境已删除', 'success');
    } catch (error) {
      logger.error(error);
      toast('删除环境失败', 'error');
    }
  };

  const handleEdit = (env: JenkinsEnvironment) => {
    setEditingEnv(env);
    setIsDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingEnv(null);
    setIsDialogOpen(true);
  };

  const handleSetCurrent = async (id: string) => {
    try {
      const targetEnv = environments?.find((env) => env.id === id);
      await updateSetting('jenkins_current_env', id);
      if (targetEnv) {
        await syncLegacyJenkinsSettings({
          host: targetEnv.host,
          user: targetEnv.user,
          token: targetEnv.token,
        });
      }
      toast('已切换当前环境', 'success');
    } catch (error) {
      logger.error(error);
      toast('切换环境失败', 'error');
    }
  };

  return {
    environments: environments || [],
    currentEnvId,
    isDialogOpen,
    editingEnv,
    setIsDialogOpen,
    handleDelete,
    handleEdit,
    handleAdd,
    handleSetCurrent,
  };
}
