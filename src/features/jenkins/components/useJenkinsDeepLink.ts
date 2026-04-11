import { useEffect } from 'react';
import { type JenkinsEnvironment, db } from '@/db';
import { syncLegacyJenkinsSettings } from '@/lib/db/jenkins';
import { updateSetting } from '@/lib/db/settings';
import type { BuildJobState } from './jenkinsViewShared';

interface UseJenkinsDeepLinkOptions {
  currentEnvId: string | undefined;
  environments: JenkinsEnvironment[];
  onBuildJobChange: (job: BuildJobState) => void;
  onShouldCloseOnSuccessChange: (shouldClose: boolean) => void;
}

export function useJenkinsDeepLink({
  currentEnvId,
  environments,
  onBuildJobChange,
  onShouldCloseOnSuccessChange,
}: UseJenkinsDeepLinkOptions) {
  useEffect(() => {
    const checkDeepLink = async () => {
      const params = new URLSearchParams(window.location.search);
      const buildJobUrl = params.get('buildJobUrl');
      const targetEnvId = params.get('envId');

      if (targetEnvId && targetEnvId !== currentEnvId) {
        const targetEnv = environments.find((env) => env.id === targetEnvId);
        await updateSetting('jenkins_current_env', targetEnvId);
        if (targetEnv) {
          await syncLegacyJenkinsSettings({
            host: targetEnv.host,
            user: targetEnv.user,
            token: targetEnv.token,
          });
        }
      }

      if (buildJobUrl) {
        const job = await db.jobs.get(buildJobUrl);
        if (job) {
          onBuildJobChange({ url: job.url, name: job.name, envId: job.env });
          onShouldCloseOnSuccessChange(true);
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.delete('buildJobUrl');
          newUrl.searchParams.delete('envId');
          newUrl.searchParams.delete('tab');
          window.history.replaceState({}, '', newUrl.toString());
        }
      }
    };

    void checkDeepLink();
  }, [currentEnvId, environments, onBuildJobChange, onShouldCloseOnSuccessChange]);
}
