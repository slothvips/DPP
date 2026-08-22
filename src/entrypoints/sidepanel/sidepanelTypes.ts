export type TabId =
  | 'links'
  | 'jenkins'
  | 'hotNews'
  | 'recorder'
  | 'testing'
  | 'blackboard'
  | 'aiAssistant'
  | 'playground'
  | 'totp';

export interface FeatureToggles {
  hotNews: boolean;
  links: boolean;
  blackboard: boolean;
  jenkins: boolean;
  recorder: boolean;
  testing: boolean;
  aiAssistant: boolean;
  playground: boolean;
  totp: boolean;
}

export const DEFAULT_FEATURE_TOGGLES: FeatureToggles = {
  hotNews: true,
  links: true,
  blackboard: true,
  jenkins: true,
  recorder: true,
  testing: true,
  aiAssistant: true,
  playground: true,
  totp: true,
};
