import { useToast } from '@/components/ui/toast';
import type { JenkinsEnvironment, MyBuildItem } from '@/db';
import { JenkinsService } from '@/features/jenkins/service';
import { syncLegacyJenkinsSettings } from '@/lib/db/jenkins';
import { updateSetting } from '@/lib/db/settings';
import { useConfirmDialog } from '@/utils/confirm-dialog';
import { logger } from '@/utils/logger';
import type { BuildJobState } from './jenkinsViewShared';

interface UseJenkinsViewActionsOptions {
  environments: JenkinsEnvironment[];
  expandedUrls: Set<string>;
  jenkinsHost?: string;
  jenkinsUser?: string;
  jenkinsToken?: string;
  shouldCloseOnSuccess: boolean;
  onBuildJobChange: (job: BuildJobState | null) => void;
  onExpandedUrlsChange: (value: Set<string>) => void;
  onLoadingChange: (loading: boolean) => void;
}

export function useJenkinsViewActions({
  environments,
  expandedUrls,
  jenkinsHost,
  jenkinsUser,
  jenkinsToken,
  shouldCloseOnSuccess,
  onBuildJobChange,
  onExpandedUrlsChange,
  onLoadingChange,
}: UseJenkinsViewActionsOptions) {
  const { toast } = useToast();
  const { confirm } = useConfirmDialog();

  const handleSync = async () => {
    if (!jenkinsHost || !jenkinsUser || !jenkinsToken) {
      toast('请先在设置中配置 Jenkins', 'error');
      return;
    }

    onLoadingChange(true);
    try {
      const jobCount = await JenkinsService.fetchAllJobs();
      toast(`采集完成，Job: ${jobCount}`, 'success');
    } catch (e) {
      logger.error('Sync failed', e);
      toast('采集失败，请检查控制台', 'error');
    } finally {
      onLoadingChange(false);
    }
  };

  const handleEnvChange = async (envId: string) => {
    try {
      const targetEnv = environments.find((env) => env.id === envId);
      await updateSetting('jenkins_current_env', envId);
      if (targetEnv) {
        await syncLegacyJenkinsSettings({
          host: targetEnv.host,
          user: targetEnv.user,
          token: targetEnv.token,
        });
      }
      toast('已切换环境', 'success');
    } catch (e) {
      logger.error('Failed to switch env:', e);
      toast('切换环境失败', 'error');
    }
  };

  const handleToggleShowOthers = async (checked: boolean) => {
    try {
      await updateSetting('show_others_builds', checked);
    } catch (e) {
      logger.error('Failed to toggle show others builds:', e);
      toast('设置保存失败', 'error');
    }
  };

  const handleCancelBuild = async (build: MyBuildItem) => {
    const confirmed = await confirm(
      `确定要取消 "${build.jobName} #${build.number}" 吗？`,
      '确认取消构建',
      'danger'
    );
    if (!confirmed) return;

    try {
      await JenkinsService.cancelBuild(build.jobUrl, build.number, build.env);
      toast('取消构建请求已发送', 'success');
    } catch (e) {
      logger.error('Cancel build failed', e);
      toast('取消构建失败', 'error');
    }
  };

  const toggleExpand = (url: string) => {
    const next = new Set(expandedUrls);
    if (next.has(url)) next.delete(url);
    else next.add(url);
    onExpandedUrlsChange(next);
  };

  const openBuildDialog = (job: BuildJobState) => {
    onBuildJobChange(job);
  };

  const closeBuildDialog = () => {
    onBuildJobChange(null);
  };

  const handleBuildSuccess = () => {
    if (shouldCloseOnSuccess) {
      toast('构建已触发，窗口即将关闭...', 'success');
      setTimeout(() => {
        window.close();
      }, 2000);
    }
  };

  return {
    closeBuildDialog,
    handleBuildSuccess,
    handleCancelBuild,
    handleEnvChange,
    handleSync,
    handleToggleShowOthers,
    openBuildDialog,
    toggleExpand,
  };
}
