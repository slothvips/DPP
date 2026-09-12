import { useCallback, useEffect, useRef } from 'react';
import { JENKINS } from '@/config/constants';
import type { MyBuildItem } from '@/db';
import { JenkinsService } from '@/features/jenkins/service';
import { logger } from '@/utils/logger';

interface UseJenkinsBuildPollingOptions {
  enabled: boolean;
  envId?: string;
  onBuildsChange: (builds: MyBuildItem[]) => void;
  onRemoteError?: (errored: boolean) => void;
  onLoadingChange: (loading: boolean) => void;
  onNextRefreshTimeChange: (value: number | null) => void;
}

const MAX_FINISHED_RESOLVES = 20;

/**
 * Polls Jenkins for builds and hands the remote result to the caller. Running
 * builds are polled frequently; a build that leaves the executors is resolved
 * immediately from its own build URL so the history updates near real-time.
 */
export function useJenkinsBuildPolling({
  enabled,
  envId,
  onBuildsChange,
  onRemoteError,
  onLoadingChange,
  onNextRefreshTimeChange,
}: UseJenkinsBuildPollingOptions) {
  const fullBuildsRef = useRef<MyBuildItem[]>([]);
  const activeIdsRef = useRef<Set<string>>(new Set());
  const refreshRef = useRef<() => void>(() => {});
  const refresh = useCallback(() => refreshRef.current(), []);

  useEffect(() => {
    if (!enabled) return;

    let mounted = true;
    let timeoutId: NodeJS.Timeout;
    let isPollingInFlight = false;
    let lastFullScanAt = 0;
    fullBuildsRef.current = [];
    activeIdsRef.current = new Set();

    const emit = (builds: MyBuildItem[]) => {
      const next = [...builds].sort((a, b) => b.timestamp - a.timestamp);
      fullBuildsRef.current = next;
      onBuildsChange(next);
    };

    const refreshNow = async () => {
      if (isPollingInFlight) return;
      clearTimeout(timeoutId);
      isPollingInFlight = true;
      try {
        onLoadingChange(true);
        const builds = await JenkinsService.fetchMyBuilds();
        if (!mounted) return;
        lastFullScanAt = Date.now();
        emit(Array.isArray(builds) ? builds : []);
        onRemoteError?.(false);
      } catch (error) {
        logger.error('Manual My Builds refresh failed', error);
        if (mounted) onRemoteError?.(true);
      } finally {
        isPollingInFlight = false;
        if (mounted) {
          onLoadingChange(false);
          schedule(
            activeIdsRef.current.size > 0
              ? JENKINS.ACTIVE_POLL_INTERVAL_MS
              : JENKINS.IDLE_POLL_INTERVAL_MS
          );
        }
      }
    };
    refreshRef.current = () => void refreshNow();

    const schedule = (delay: number) => {
      if (!mounted) return;
      onNextRefreshTimeChange(Date.now() + delay);
      timeoutId = setTimeout(() => void poll(), delay);
    };

    const poll = async (skipFullScan = false) => {
      if (isPollingInFlight) {
        schedule(JENKINS.POLL_INTERVAL_MS);
        return;
      }

      if (document.visibilityState === 'hidden') {
        schedule(JENKINS.POLL_INTERVAL_MS * 3);
        return;
      }

      isPollingInFlight = true;
      let activeCount = 0;
      try {
        onLoadingChange(true);

        let active: MyBuildItem[] = [];
        try {
          const result = await JenkinsService.fetchActiveBuilds();
          if (!mounted) return;
          active = Array.isArray(result) ? result : [];
        } catch (error) {
          logger.warn('Jenkins active build poll failed', error);
        }
        if (!mounted) return;

        const previousIds = activeIdsRef.current;
        const currentIds = new Set(active.map((build) => build.id));
        const finishedIds = [...previousIds].filter((id) => !currentIds.has(id));
        activeIdsRef.current = currentIds;
        activeCount = active.length;

        if (activeCount === 0) {
          // Nothing running: only pay for the full job-tree scan on the slower
          // cadence. The light executor poll already keeps newly started builds
          // visible. The first poll reuses the scan performed by start().
          const dueForFullScan =
            !skipFullScan && Date.now() - lastFullScanAt >= JENKINS.FULL_REFRESH_INTERVAL_MS;
          if (dueForFullScan) {
            const builds = await JenkinsService.fetchMyBuilds(JENKINS.IDLE_BUILDS_PER_JOB);
            if (!mounted) return;
            lastFullScanAt = Date.now();
            emit(Array.isArray(builds) ? builds : []);
          }
        } else {
          const merged = new Map(
            (Array.isArray(fullBuildsRef.current) ? fullBuildsRef.current : []).map((build) => [
              build.id,
              build,
            ])
          );
          for (const build of active) merged.set(build.id, build);

          if (finishedIds.length > 0) {
            const summaries = await Promise.all(
              finishedIds
                .slice(0, MAX_FINISHED_RESOLVES)
                .map((id) => JenkinsService.getBuildSummary(id, envId).catch(() => null))
            );
            if (!mounted) return;
            for (const summary of summaries) {
              if (summary) merged.set(summary.id, summary);
            }
          }
          emit([...merged.values()]);
        }
        onRemoteError?.(false);
      } catch (error) {
        logger.error('Auto-refresh My Builds failed', error);
        if (mounted) onRemoteError?.(true);
      } finally {
        isPollingInFlight = false;
        if (mounted) {
          onLoadingChange(false);
          schedule(
            activeCount > 0 ? JENKINS.ACTIVE_POLL_INTERVAL_MS : JENKINS.IDLE_POLL_INTERVAL_MS
          );
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isPollingInFlight) {
        clearTimeout(timeoutId);
        void poll();
      }
    };

    const start = async () => {
      try {
        onLoadingChange(true);
        const builds = await JenkinsService.fetchMyBuilds();
        if (mounted) {
          lastFullScanAt = Date.now();
          emit(Array.isArray(builds) ? builds : []);
          onRemoteError?.(false);
        }
      } catch (error) {
        logger.error('Initial My Builds refresh failed', error);
        if (mounted) onRemoteError?.(true);
      } finally {
        if (mounted) onLoadingChange(false);
      }
      if (mounted) void poll(true);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    void start();

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      refreshRef.current = () => {};
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, envId, onBuildsChange, onLoadingChange, onNextRefreshTimeChange, onRemoteError]);

  return { refresh };
}
