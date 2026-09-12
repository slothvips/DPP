import { useEffect } from 'react';
import { type JenkinsEnvironment, db } from '@/db';
import { syncLegacyJenkinsSettings } from '@/lib/db/jenkins';
import { updateSetting } from '@/lib/db/settings';
import { logger } from '@/utils/logger';
import type { BuildJobState } from './jenkinsViewShared';

export type JenkinsWorkbenchView = 'run' | 'jobs' | 'queue';

interface UseJenkinsDeepLinkOptions {
  currentEnvId: string | undefined;
  environments: JenkinsEnvironment[];
  onBuildJobChange: (job: BuildJobState) => void;
  onShouldCloseOnSuccessChange: (shouldClose: boolean) => void;
  onViewChange: (view: JenkinsWorkbenchView) => void;
}

export function useJenkinsDeepLink({
  currentEnvId,
  environments,
  onBuildJobChange,
  onShouldCloseOnSuccessChange,
  onViewChange,
}: UseJenkinsDeepLinkOptions) {
  useEffect(() => {
    const checkDeepLink = async () => {
      const params = new URLSearchParams(window.location.search);
      const buildJobUrl = params.get('buildJobUrl');
      const targetEnvId = params.get('envId');
      const requestedView = params.get('tab');

      const targetEnv = targetEnvId
        ? environments.find((env) => env.id === targetEnvId)
        : environments.find((env) => env.id === currentEnvId);
      if (targetEnvId && !targetEnv) {
        logger.warn('Ignoring Jenkins deep link with an unknown environment', targetEnvId);
        return;
      }

      if (requestedView === 'run' || requestedView === 'jobs' || requestedView === 'queue') {
        onViewChange(requestedView);
      }

      if (targetEnv && targetEnv.id !== currentEnvId) {
        await updateSetting('jenkins_current_env', targetEnv.id);
        await syncLegacyJenkinsSettings({
          host: targetEnv.host,
          user: targetEnv.user,
          token: targetEnv.token,
        });
      }

      if (buildJobUrl && targetEnv) {
        const job = await db.jenkinsJobs
          .where('envId')
          .equals(targetEnv.id)
          .filter((candidate) => candidate.url === buildJobUrl)
          .first();
        if (job) {
          onBuildJobChange({ url: job.url, name: job.name, envId: job.env });
          onShouldCloseOnSuccessChange(true);
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.delete('buildJobUrl');
          newUrl.searchParams.delete('envId');
          window.history.replaceState({}, '', newUrl.toString());
        } else {
          logger.warn(
            'Ignoring Jenkins deep link for an unknown or other-environment Job',
            buildJobUrl
          );
        }
      }

      if (requestedView === 'run' || requestedView === 'jobs' || requestedView === 'queue') {
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('tab');
        window.history.replaceState({}, '', newUrl.toString());
      }
    };

    const handleRecentActionReplay = () => {
      void checkDeepLink();
    };

    window.addEventListener('dpp:replay-jenkins', handleRecentActionReplay);
    void checkDeepLink();
    return () => window.removeEventListener('dpp:replay-jenkins', handleRecentActionReplay);
  }, [currentEnvId, environments, onBuildJobChange, onShouldCloseOnSuccessChange, onViewChange]);
}
