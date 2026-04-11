import type { Setting, SettingKey } from '@/db/types';
import { getSettingValue } from './optionsShared';
import type { FeatureTogglesState } from './optionsTypes';

export const FEATURE_KEY_MAP = {
  hotNews: 'feature_hotnews_enabled',
  links: 'feature_links_enabled',
  blackboard: 'feature_blackboard_enabled',
  jenkins: 'feature_jenkins_enabled',
  recorder: 'feature_recorder_enabled',
  aiAssistant: 'feature_ai_assistant_enabled',
  playground: 'feature_playground_enabled',
} as const satisfies Record<keyof FeatureTogglesState, SettingKey>;

export const FEATURE_LABEL_MAP: Record<keyof FeatureTogglesState, string> = {
  hotNews: '资讯',
  links: '链接',
  blackboard: '黑板',
  jenkins: 'Jenkins',
  recorder: '录制',
  aiAssistant: 'D仔',
  playground: '游乐园',
};

export const DEFAULT_FEATURE_TOGGLES: FeatureTogglesState = {
  hotNews: true,
  links: true,
  blackboard: true,
  jenkins: true,
  recorder: true,
  aiAssistant: true,
  playground: true,
};

export function resolveFeatureToggles(settings: Setting[]): FeatureTogglesState {
  return {
    hotNews: getSettingValue(settings, 'feature_hotnews_enabled') !== false,
    links: getSettingValue(settings, 'feature_links_enabled') !== false,
    blackboard: getSettingValue(settings, 'feature_blackboard_enabled') !== false,
    jenkins: getSettingValue(settings, 'feature_jenkins_enabled') !== false,
    recorder: getSettingValue(settings, 'feature_recorder_enabled') !== false,
    aiAssistant: getSettingValue(settings, 'feature_ai_assistant_enabled') !== false,
    playground: getSettingValue(settings, 'feature_playground_enabled') !== false,
  };
}
