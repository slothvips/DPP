import { Box, Flame, Link, MessageSquare, Sparkles, Video } from 'lucide-react';
import type { ReactNode } from 'react';
import { JenkinsIcon } from '@/components/ui/JenkinsIcon';
import type { FeatureToggles, TabId } from './sidepanelTypes';

interface TabConfig {
  label: string;
  testid: string;
  icon: ReactNode;
  getVisible: (props: { featureToggles: FeatureToggles; showJenkinsTab: boolean }) => boolean;
}

export const DEFAULT_TAB_ORDER: TabId[] = [
  'blackboard',
  'jenkins',
  'links',
  'recorder',
  'hotNews',
  'aiAssistant',
  'playground',
];

export const TAB_CONFIG: Record<TabId, TabConfig> = {
  blackboard: {
    label: '黑板',
    testid: 'tab-blackboard',
    icon: <MessageSquare className="h-4 w-4" />,
    getVisible: ({ featureToggles }) => featureToggles.blackboard,
  },
  jenkins: {
    label: 'Jenkins',
    testid: 'tab-jenkins',
    icon: <JenkinsIcon className="h-4 w-4" />,
    getVisible: ({ showJenkinsTab }) => showJenkinsTab,
  },
  links: {
    label: '链接',
    testid: 'tab-links',
    icon: <Link className="h-4 w-4" />,
    getVisible: ({ featureToggles }) => featureToggles.links,
  },
  recorder: {
    label: '录制',
    testid: 'tab-recorder',
    icon: <Video className="h-4 w-4" />,
    getVisible: ({ featureToggles }) => featureToggles.recorder,
  },
  hotNews: {
    label: '资讯',
    testid: 'tab-hotnews',
    icon: <Flame className="h-4 w-4" />,
    getVisible: ({ featureToggles }) => featureToggles.hotNews,
  },
  aiAssistant: {
    label: 'D仔',
    testid: 'tab-ai-assistant',
    icon: <Sparkles className="h-4 w-4" />,
    getVisible: ({ featureToggles }) => featureToggles.aiAssistant,
  },
  playground: {
    label: '游乐园',
    testid: 'tab-playground',
    icon: <Box className="h-4 w-4" />,
    getVisible: ({ featureToggles }) => featureToggles.playground,
  },
};
