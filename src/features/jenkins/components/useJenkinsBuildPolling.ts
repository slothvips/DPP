import { useEffect } from 'react';
import { JENKINS } from '@/config/constants';
import { JenkinsService } from '@/features/jenkins/service';
import { logger } from '@/utils/logger';

interface UseJenkinsBuildPollingOptions {
  enabled: boolean;
  onError: (error: Error) => void;
  onLoadingChange: (loading: boolean) => void;
  onNextRefreshTimeChange: (value: number | null) => void;
  onRefresh: () => void;
}

export function useJenkinsBuildPolling({
  enabled,
  onError,
  onLoadingChange,
  onNextRefreshTimeChange,
  onRefresh,
}: UseJenkinsBuildPollingOptions) {
  useEffect(() => {
    if (!enabled) return;

    let mounted = true;
    let timeoutId: NodeJS.Timeout;
    let isPollingInFlight = false;

    const poll = async () => {
      if (isPollingInFlight) {
        if (mounted) {
          timeoutId = setTimeout(poll, JENKINS.POLL_INTERVAL_MS);
        }
        return;
      }

      if (document.visibilityState === 'hidden') {
        timeoutId = setTimeout(poll, JENKINS.POLL_INTERVAL_MS * 3);
        return;
      }

      isPollingInFlight = true;
      try {
        onLoadingChange(true);
        await JenkinsService.fetchMyBuilds();
        onLoadingChange(false);
        onRefresh();
        onNextRefreshTimeChange(Date.now() + JENKINS.POLL_INTERVAL_MS);
      } catch (error) {
        logger.error('Auto-refresh My Builds failed', error);
        onLoadingChange(false);
        onError(error instanceof Error ? error : new Error(String(error)));
      } finally {
        isPollingInFlight = false;
        if (mounted) {
          timeoutId = setTimeout(poll, JENKINS.POLL_INTERVAL_MS);
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isPollingInFlight) {
        clearTimeout(timeoutId);
        void poll();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    void poll();

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, onError, onLoadingChange, onNextRefreshTimeChange, onRefresh]);
}
