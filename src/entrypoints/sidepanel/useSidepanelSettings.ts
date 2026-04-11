import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import type { JenkinsEnvironment } from '@/db';
import { DEFAULT_FEATURE_TOGGLES } from './sidepanelTypes';

export function useSidepanelSettings() {
  const jenkinsEnvironments = useLiveQuery(async () => {
    const setting = await db.settings.get('jenkins_environments');
    return setting?.value as JenkinsEnvironment[] | undefined;
  });

  const featureToggles =
    useLiveQuery(async () => {
      const hotNews = await db.settings.get('feature_hotnews_enabled');
      const links = await db.settings.get('feature_links_enabled');
      const blackboard = await db.settings.get('feature_blackboard_enabled');
      const jenkins = await db.settings.get('feature_jenkins_enabled');
      const recorder = await db.settings.get('feature_recorder_enabled');
      const aiAssistant = await db.settings.get('feature_ai_assistant_enabled');
      const playground = await db.settings.get('feature_playground_enabled');

      return {
        hotNews: hotNews?.value !== false,
        links: links?.value !== false,
        blackboard: blackboard?.value !== false,
        jenkins: jenkins?.value !== false,
        recorder: recorder?.value !== false,
        aiAssistant: aiAssistant?.value !== false,
        playground: playground?.value !== false,
      };
    }) ?? DEFAULT_FEATURE_TOGGLES;

  const serverUrl = useLiveQuery(async () => {
    const setting = await db.settings.get('custom_server_url');
    return setting?.value as string | undefined;
  });

  const isMinimalMode = new URLSearchParams(window.location.search).has('buildJobUrl');
  const hasJenkins = (jenkinsEnvironments?.length ?? 0) > 0;

  return {
    featureToggles,
    isMinimalMode,
    showJenkinsTab: hasJenkins && featureToggles.jenkins,
    showSyncButton: !!serverUrl,
  };
}
